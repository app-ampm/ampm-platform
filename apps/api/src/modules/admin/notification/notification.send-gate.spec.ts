import { describe, expect, it, vi } from "vitest";

import { FakeNotificationRepository, makeService } from "../../../../test/notification-fakes.js";
import type { NotificationAdapter } from "./notification.adapter.js";
import type { GatedNotification } from "./notification-send-gates.js";

/*
 * The send path's gates (D-188 §5): a module registers a gate for a template-key prefix, and the worker
 * asks it before it sends a queued notification of that prefix. A gate that answers false drops the
 * notification: it is marked failed and its render data, address and Reply-To are cleared, never sent.
 * The hotel form's kill switch is such a gate (hotel-form-email-gate.ts).
 */

const REQUEST_ID = "0192f1a0-0000-7000-8000-0000000000b1";

function external(templateKey: string) {
  return {
    recipientType: "external" as const,
    recipientId: REQUEST_ID,
    recipientAddress: "sales@synthetic-hotel.example",
    channel: "email" as const,
    eventType: templateKey,
    templateKey,
    entityType: "hotel_info_request",
    entityId: REQUEST_ID,
    variables: {
      reference: "HIR-2026-0001",
      hotelName: "Synthetic Lake Hotel",
      expiresOn: "24 December 2026, 15:30 IST",
      link: "https://site.synthetic.example/hotel-form#k=hfl_secret",
    },
    replyTo: "desk@ampm.example",
  };
}

function harness() {
  const repo = new FakeNotificationRepository();
  const send = vi.fn(async () => ({ providerRef: "synthetic:1" }));
  const adapter: NotificationAdapter = { send };
  const service = makeService(repo, { adapter });
  return { repo, send, service };
}

describe("NotificationService send gates", () => {
  it("drops a queued notification its gate no longer admits: failed, cleared, never sent", async () => {
    const { repo, send, service } = harness();
    service.registerSendGate("hotel_form.", async () => false);
    const result = await service.queue(external("hotel_form.link"));
    if (result.suppressed) throw new Error("an external email is never suppressed");
    expect(repo.rows.get(result.notificationId)).toMatchObject({
      status: "failed",
      data: null,
      recipientAddress: null,
      replyTo: null,
      sentAt: null,
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("sends a notification its gate admits", async () => {
    const { repo, send, service } = harness();
    service.registerSendGate("hotel_form.", async () => true);
    const result = await service.queue(external("hotel_form.link"));
    if (result.suppressed) throw new Error("an external email is never suppressed");
    expect(repo.rows.get(result.notificationId)?.status).toBe("sent");
    expect(send).toHaveBeenCalledOnce();
  });

  it("asks only the gate of the template's prefix, and shows it neither the address nor the data", async () => {
    const { repo, service } = harness();
    const seen: GatedNotification[] = [];
    service.registerSendGate("hotel_form.", async (notification) => {
      seen.push(notification);
      return true;
    });
    const other = await service.queue({
      ...external("staff.invite"),
      variables: { name: "Pat", activationUrl: "x" },
    });
    if (other.suppressed) throw new Error("an external email is never suppressed");
    expect(seen).toEqual([]);
    expect(repo.rows.get(other.notificationId)?.status).toBe("sent");
    await service.queue(external("hotel_form.link"));
    expect(seen).toEqual([
      {
        templateKey: "hotel_form.link",
        recipientType: "external",
        recipientId: REQUEST_ID,
        channel: "email",
        entityType: "hotel_info_request",
        entityId: REQUEST_ID,
      },
    ]);
  });

  it("retries a gate that fails, and clears the row once every attempt has failed", async () => {
    const { repo, send, service } = harness();
    const gate = vi.fn(async () => {
      throw new Error("configuration unreadable");
    });
    service.registerSendGate("hotel_form.", gate);
    const result = await service.queue(external("hotel_form.link"));
    if (result.suppressed) throw new Error("an external email is never suppressed");
    expect(gate.mock.calls.length).toBeGreaterThan(1);
    expect(repo.rows.get(result.notificationId)).toMatchObject({
      status: "failed",
      data: null,
      recipientAddress: null,
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("refuses a second gate for a prefix that has one", () => {
    const { service } = harness();
    service.registerSendGate("hotel_form.", async () => true);
    expect(() => service.registerSendGate("hotel_form.", async () => true)).toThrow();
  });
});
