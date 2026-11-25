import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { JobQueue } from "../src/jobs/job-queue.js";
import { NOTIFICATION_GATE_REF_KEY } from "../src/modules/admin/notification/notification-data.js";
import { sendNotificationJob } from "../src/modules/admin/notification/notification.service.js";
import {
  newSuiteHotel,
  requestCalls,
  rowsHolding,
  secretOf,
  setFormPolicy,
  startRequestSuite,
  stopRequestSuite,
  type RequestSuite,
} from "./hotel-info-requests-suite.js";

const RECIPIENT = "sales@synthetic-hotel.example";

/**
 * Emailing a hotel information request's link end to end (D-188 §5): queued to the recipient AMPM
 * entered only when the hotel form's mode, read past the configuration cache, admits the request (on, or
 * test_only for a Super Admin's test request); otherwise the request still stands and the answer says
 * why. The send job, inline here, sends it through the console adapter and clears its address and data;
 * and the worker drops a queued hotel-form email whose mode no longer admits it, whose request is no
 * longer live, or whose link was reissued after it was queued.
 */
describe("Hotel information requests: the link's email and the kill switch (e2e)", () => {
  let suite: RequestSuite;
  const { create, reissue, revoke } = requestCalls(() => suite);

  /** A hotel of the suite with a request created for it, emailed when asked. */
  async function requestFor(suffix: string, emailIt: boolean, role: "sa" | "ht" = "ht") {
    const hotelId = await newSuiteHotel(suite, suffix, {
      status: role === "sa" ? "draft" : "active",
    });
    const body = { target: "existing", hotelId, recipientEmail: RECIPIENT, emailIt };
    const isTest = role === "sa" ? { isTest: true } : {};
    return (await create(role, { ...body, ...isTest }).expect(201)).body.data;
  }

  const emailsOf = (requestId: string) =>
    suite.prisma.notification.findMany({ where: { recipientId: requestId } });

  /** A request's link email as the mailer queues it, for the link's generation, not sent yet. */
  const queuedLink = (
    issued: { request: { id: string; reference: string }; link: { url: string } },
    generation: number,
  ) =>
    suite.prisma.notification.create({
      data: {
        recipientType: "external",
        recipientId: issued.request.id,
        recipientAddress: RECIPIENT,
        replyTo: "desk@ampm.example",
        channel: "email",
        templateKey: "hotel_form.link",
        entityType: "hotel_info_request",
        entityId: issued.request.id,
        status: "queued",
        data: {
          reference: issued.request.reference,
          hotelName: "E2E Request Hotel",
          expiresOn: "24 December 2026, 15:30 IST",
          link: issued.link.url,
          [NOTIFICATION_GATE_REF_KEY]: String(generation),
        },
      },
    });

  /** Runs the send job of a queued email, as the worker does, and answers the row it leaves. */
  async function send(id: string) {
    const jobs = suite.app.get(JobQueue);
    await jobs.enqueue(
      sendNotificationJob,
      { notificationId: id },
      { idempotencyKey: `e2e.${id}` },
    );
    return suite.prisma.notification.findFirstOrThrow({ where: { id } });
  }

  beforeAll(async () => {
    suite = await startRequestSuite("e2e-hir-mail-");
  });

  afterAll(async () => {
    await stopRequestSuite(suite);
  });

  it("queues nothing while the mode is off: the request stands, and the answer says why", async () => {
    await setFormPolicy(suite, { mode: "off" });
    const data = await requestFor("off", true);
    expect(data.email).toBe("mode_off");
    expect(data.request).toMatchObject({ status: "open", linkEmailedAt: null });
    expect(await emailsOf(data.request.id)).toEqual([]);
  });

  it("in test_only, emails a Super Admin's test request and nothing else", async () => {
    await setFormPolicy(suite, { mode: "test_only" });
    const other = await requestFor("test-only-other", true);
    expect(other.email).toBe("mode_test_only");
    expect(await emailsOf(other.request.id)).toEqual([]);
    const test = await requestFor("test-only-test", true, "sa");
    expect(test.email).toBe("queued");
    expect(test.request.linkEmailedAt).not.toBeNull();
    expect(test.request.events[0]).toMatchObject({
      eventType: "link_emailed",
      detail: { generation: 1 },
    });
  });

  it("when on, sends the link to the recipient as an external email, then clears its address and data", async () => {
    await setFormPolicy(suite, { mode: "on", replyTo: "desk@ampm.example" });
    const data = await requestFor("on", true);
    expect(data.email).toBe("queued");
    const [email, ...more] = await emailsOf(data.request.id);
    expect(more).toEqual([]);
    expect(email).toMatchObject({
      recipientType: "external",
      channel: "email",
      templateKey: "hotel_form.link",
      entityType: "hotel_info_request",
      entityId: data.request.id,
      status: "sent",
      recipientAddress: null,
      replyTo: null,
    });
    expect(email?.data).toBeNull();
    expect(await rowsHolding(suite.prisma, secretOf(data.link.url).slice(4))).toMatchObject({
      notifications: 0,
      events: 0,
      audits: 0,
    });
  });

  it("emails a reissued link only when asked, and refuses to without a recipient", async () => {
    await setFormPolicy(suite, { mode: "on" });
    const data = await requestFor("reissue", false);
    expect(data.email).toBe("not_requested");
    const again = await reissue("ht", data.request.id, { emailIt: true }).expect(200);
    expect(again.body.data).toMatchObject({ email: "queued", request: { tokenGeneration: 2 } });
    expect(await emailsOf(data.request.id)).toHaveLength(1);
    const hotelId = await newSuiteHotel(suite, "no-recipient", { status: "active" });
    const bare = await create("ht", { target: "existing", hotelId }).expect(201);
    await reissue("ht", bare.body.data.request.id, { emailIt: true }).expect(400);
  });

  it("drops a queued hotel-form email at send time when the mode no longer admits it, clearing it", async () => {
    const data = await requestFor("dropped", false);
    for (const mode of ["off", "test_only"] as const) {
      await setFormPolicy(suite, { mode });
      expect(await send((await queuedLink(data, 1)).id)).toMatchObject({
        status: "failed",
        sentAt: null,
        recipientAddress: null,
        replyTo: null,
        data: null,
      });
    }
    await setFormPolicy(suite, { mode: "on" });
    expect(await send((await queuedLink(data, 1)).id)).toMatchObject({
      status: "sent",
      data: null,
    });
  });

  it("drops a queued link email whose request was revoked, or whose link was reissued, since it was queued", async () => {
    await setFormPolicy(suite, { mode: "on" });
    const revoked = await requestFor("gate-revoked", false);
    const beforeRevoke = await queuedLink(revoked, 1);
    await revoke("ht", revoked.request.id, { reason: "E2E revoke" }).expect(200);
    expect(await send(beforeRevoke.id)).toMatchObject({
      status: "failed",
      recipientAddress: null,
      replyTo: null,
      data: null,
    });
    const rotated = await requestFor("gate-reissued", false);
    const firstLink = await queuedLink(rotated, 1);
    const again = await reissue("ht", rotated.request.id, { emailIt: false }).expect(200);
    expect(await send(firstLink.id)).toMatchObject({ status: "failed", sentAt: null, data: null });
    const secondLink = await queuedLink({ ...rotated, link: again.body.data.link }, 2);
    expect(await send(secondLink.id)).toMatchObject({ status: "sent", data: null });
  });
});
