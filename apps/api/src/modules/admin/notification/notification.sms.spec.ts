import { describe, expect, it } from "vitest";

import { FakeNotificationRepository, makeService } from "../../../../test/notification-fakes.js";
import type { NotificationDelivery } from "./notification.adapter.js";

/** The SMS channel's delivery (D-147): required messages, the mobile as the address, failing closed. */
describe("NotificationService: SMS", () => {
  it("sends a required SMS to the recipient's mobile even with the channel switched off (D-147)", async () => {
    const repo = new FakeNotificationRepository();
    repo.disabled.add("user-1|auth.client_otp|sms");
    const sent: NotificationDelivery[] = [];
    const service = makeService(repo, {
      templates: { "auth.client_otp": { sms: { text: "{{code}} is your AMPM sign-in code." } } },
      adapter: {
        async send(delivery) {
          sent.push(delivery);
          return { providerRef: "sms-1" };
        },
      },
    });
    const result = await service.queue({
      recipientType: "user",
      recipientId: "user-1",
      channel: "sms",
      eventType: "auth.client_otp",
      templateKey: "auth.client_otp",
      variables: { code: "482913" },
      required: true,
    });
    if (result.suppressed) throw new Error("a required message must not be suppressed");
    expect(repo.rows.get(result.notificationId)?.status).toBe("sent");
    expect(sent).toEqual([
      expect.objectContaining({
        channel: "sms",
        address: "+919876543210",
        content: { kind: "sms", text: "482913 is your AMPM sign-in code." },
        variables: { code: "482913" },
      }),
    ]);
  });

  it("fails closed when the SMS recipient has no mobile on file", async () => {
    const repo = new FakeNotificationRepository();
    repo.recipientPhoneValue = null;
    const sent: NotificationDelivery[] = [];
    const service = makeService(repo, {
      templates: { "auth.client_otp": { sms: { text: "{{code}} is your AMPM sign-in code." } } },
      adapter: {
        async send(delivery) {
          sent.push(delivery);
          return { providerRef: "nope" };
        },
      },
    });
    const result = await service.queue({
      recipientType: "user",
      recipientId: "user-1",
      channel: "sms",
      eventType: "auth.client_otp",
      templateKey: "auth.client_otp",
      variables: { code: "482913" },
      required: true,
    });
    if (result.suppressed) throw new Error("unexpected suppression");
    expect(repo.rows.get(result.notificationId)?.status).toBe("failed");
    expect(sent).toHaveLength(0);
  });
});
