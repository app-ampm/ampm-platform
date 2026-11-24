import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { JobQueue } from "../src/jobs/job-queue.js";
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
 * and the worker drops a queued hotel-form email whose mode no longer admits it.
 */
describe("Hotel information requests: the link's email and the kill switch (e2e)", () => {
  let suite: RequestSuite;
  const { create, reissue } = requestCalls(() => suite);

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
    const jobs = suite.app.get(JobQueue);
    const queued = async () =>
      suite.prisma.notification.create({
        data: {
          recipientType: "external",
          recipientId: data.request.id,
          recipientAddress: RECIPIENT,
          replyTo: "desk@ampm.example",
          channel: "email",
          templateKey: "hotel_form.link",
          entityType: "hotel_info_request",
          entityId: data.request.id,
          status: "queued",
          data: {
            reference: data.request.reference,
            hotelName: "E2E Request Hotel dropped",
            expiresOn: "24 December 2026, 15:30 IST",
            link: data.link.url,
          },
        },
      });
    const send = (id: string) =>
      jobs.enqueue(sendNotificationJob, { notificationId: id }, { idempotencyKey: `e2e.${id}` });
    for (const mode of ["off", "test_only"] as const) {
      await setFormPolicy(suite, { mode });
      const row = await queued();
      await send(row.id);
      expect(
        await suite.prisma.notification.findFirstOrThrow({ where: { id: row.id } }),
      ).toMatchObject({
        status: "failed",
        sentAt: null,
        recipientAddress: null,
        replyTo: null,
        data: null,
      });
    }
    await setFormPolicy(suite, { mode: "on" });
    const row = await queued();
    await send(row.id);
    expect(
      await suite.prisma.notification.findFirstOrThrow({ where: { id: row.id } }),
    ).toMatchObject({
      status: "sent",
      data: null,
    });
  });
});
