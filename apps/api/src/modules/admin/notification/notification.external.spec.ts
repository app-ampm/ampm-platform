import { describe, expect, it } from "vitest";

import {
  FakeNotificationRepository,
  makeService,
  RefusingJobDriver,
} from "../../../../test/notification-fakes.js";
import type { Principal } from "../../../policy/principal.types.js";
import type { NotificationAdapter, NotificationDelivery } from "./notification.adapter.js";

/*
 * External recipients (D-188 §5; plan §4.9): someone outside AMPM, such as the contact AMPM entered for a
 * hotel. The row's recipient_id is the request's id and its address is held only until the row leaves
 * `queued`, together with the render data (the link) and the Reply-To.
 */
describe("NotificationService: external recipients and reply-to (D-188 §5)", () => {
  const REQUEST_ID = "0196a0b0-0000-7000-8000-00000000e001";
  const HOTEL_ADDRESS = "sales@synthetic-hotel.example";
  const variables = {
    name: "Synthetic Sales",
    activationUrl: "https://site.ampm.example/x#k=SECRET",
  };

  function capture(): { adapter: NotificationAdapter; sent: NotificationDelivery[] } {
    const sent: NotificationDelivery[] = [];
    return {
      sent,
      adapter: {
        async send(delivery) {
          sent.push(delivery);
          return { providerRef: "provider-ref-external" };
        },
      },
    };
  }

  const external = {
    recipientType: "external",
    recipientId: REQUEST_ID,
    recipientAddress: HOTEL_ADDRESS,
    channel: "email",
    eventType: "hotel_form.link",
    templateKey: "staff.invite",
    variables,
  } as const;

  it("sends to the address it was queued with, never a user's, and skips the channel preference", async () => {
    const repo = new FakeNotificationRepository();
    repo.recipientEmailValue = "someone-else@ampm.example";
    repo.disabled.add(`${REQUEST_ID}|hotel_form.link|email`);
    const { adapter, sent } = capture();
    const result = await makeService(repo, { adapter }).queue(external);
    expect(result.suppressed).toBe(false);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ recipientType: "external", recipientId: REQUEST_ID });
    expect(sent[0]?.address).toBe(HOTEL_ADDRESS);
  });

  it("clears the address, the Reply-To and the render data once the email is sent", async () => {
    const repo = new FakeNotificationRepository();
    const { adapter } = capture();
    const result = await makeService(repo, { adapter }).queue({
      ...external,
      replyTo: "desk@ampm.example",
    });
    if (result.suppressed) throw new Error("unexpected suppression");
    const row = repo.rows.get(result.notificationId);
    expect(row).toMatchObject({
      status: "sent",
      recipientAddress: null,
      replyTo: null,
      data: null,
    });
  });

  it("clears them when the template cannot be rendered", async () => {
    const repo = new FakeNotificationRepository();
    const { adapter, sent } = capture();
    const result = await makeService(repo, { adapter }).queue({ ...external, variables: {} });
    if (result.suppressed) throw new Error("unexpected suppression");
    expect(sent).toHaveLength(0);
    expect(repo.rows.get(result.notificationId)).toMatchObject({
      status: "failed",
      recipientAddress: null,
      replyTo: null,
    });
  });

  it("clears them when every send attempt fails and the job dead-letters (failPermanently)", async () => {
    const repo = new FakeNotificationRepository();
    const service = makeService(repo, {
      adapter: {
        async send() {
          throw new Error("smtp boom");
        },
      },
    });
    const result = await service.queue({ ...external, replyTo: "desk@ampm.example" });
    if (result.suppressed) throw new Error("unexpected suppression");
    expect(repo.rows.get(result.notificationId)).toMatchObject({
      status: "failed",
      recipientAddress: null,
      replyTo: null,
      data: null,
    });
  });

  it("fails the row and clears them when the send job cannot be enqueued, then passes the error on", async () => {
    const repo = new FakeNotificationRepository();
    const service = makeService(repo, { driver: new RefusingJobDriver() });
    await expect(service.queue({ ...external, replyTo: "desk@ampm.example" })).rejects.toThrow(
      "the job queue is unreachable",
    );
    // No job will ever send, dead-letter or clear this row, so it must not keep the link at rest.
    expect([...repo.rows.values()]).toMatchObject([
      { status: "failed", sentAt: null, recipientAddress: null, replyTo: null, data: null },
    ]);
  });

  it("hands the adapter the Reply-To a notification was queued with, and none otherwise", async () => {
    const repo = new FakeNotificationRepository();
    const { adapter, sent } = capture();
    const service = makeService(repo, { adapter });
    await service.queue({ ...external, replyTo: "desk@ampm.example" });
    await service.queue({
      recipientType: "user",
      recipientId: "user-1",
      channel: "email",
      eventType: "staff.invited",
      templateKey: "staff.invite",
      variables,
    });
    expect(sent.map((delivery) => delivery.replyTo)).toEqual(["desk@ampm.example", undefined]);
  });

  it("refuses an external recipient with a blank address or on a channel with no address", async () => {
    const repo = new FakeNotificationRepository();
    const service = makeService(repo, capture());
    await expect(service.queue({ ...external, recipientAddress: "  " })).rejects.toMatchObject({
      code: "internal",
    });
    await expect(service.queue({ ...external, channel: "in_app" })).rejects.toMatchObject({
      code: "internal",
    });
    expect(repo.rows.size).toBe(0);
  });

  it("never puts the address or the Reply-To on a notification view", async () => {
    const repo = new FakeNotificationRepository();
    const id = "00000000-0000-7000-8000-0000000000e2";
    repo.rows.set(id, {
      id,
      recipientType: "external",
      recipientId: REQUEST_ID,
      channel: "email",
      templateKey: "staff.invite",
      entityType: null,
      entityId: null,
      status: "queued",
      providerRef: null,
      sentAt: null,
      deliveredAt: null,
      data: null,
      recipientAddress: HOTEL_ADDRESS,
      replyTo: "desk@ampm.example",
      createdAt: new Date("2026-11-24T00:00:00.000Z"),
    });
    const principal = { type: "staff", userId: "u1", memberships: [] } as unknown as Principal;
    const list = await makeService(repo).listOwn(principal, "all", { limit: 10 });
    expect(JSON.stringify(list)).not.toContain(HOTEL_ADDRESS);
    expect(JSON.stringify(list)).not.toContain("desk@ampm.example");
  });
});
