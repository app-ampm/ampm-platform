import { createMemoryLogger } from "@ampm/core";
import { describe, expect, it } from "vitest";

import type { NotificationDelivery } from "./notification.adapter.js";
import { SmtpEmailAdapter, type MailTransport } from "./smtp-email.adapter.js";

function delivery(overrides: Partial<NotificationDelivery> = {}): NotificationDelivery {
  return {
    channel: "email",
    recipientType: "user",
    recipientId: "user-1",
    address: "pat@example.com",
    templateKey: "staff.invite",
    content: { kind: "email", subject: "Hi", html: "<p>secret</p>", text: "secret" },
    ...overrides,
  };
}

/**
 * Offline contract test for the SMTP email adapter (the `*.contract.spec.ts` convention): an injected
 * fake transport stands in for nodemailer/SES, so the message the adapter builds, its provider ref, and
 * its no-personal-data behaviour are proven with no network. A live SES/Mailpit test is deferred.
 */
describe("SmtpEmailAdapter (offline contract)", () => {
  it("sends the rendered email to the resolved address and returns the message id", async () => {
    const sent: unknown[] = [];
    const transport: MailTransport = {
      async sendMail(message) {
        sent.push(message);
        return { messageId: "msg-123" };
      },
    };
    const { logger, entries } = createMemoryLogger();
    const adapter = new SmtpEmailAdapter(transport, "AMPM <no-reply@ampm.test>", logger);

    const result = await adapter.send(delivery());

    expect(result.providerRef).toBe("msg-123");
    expect(sent).toEqual([
      {
        from: "AMPM <no-reply@ampm.test>",
        to: "pat@example.com",
        subject: "Hi",
        html: "<p>secret</p>",
        text: "secret",
      },
    ]);
    const logged = entries.find((entry) => entry.event === "notification.email_sent");
    expect(logged?.fields).toMatchObject({
      channel: "email",
      templateKey: "staff.invite",
      providerRef: "msg-123",
    });
    // Neither the recipient address nor the body reaches the log (no personal data, security.md).
    expect(JSON.stringify(entries)).not.toContain("pat@example.com");
    expect(JSON.stringify(entries)).not.toContain("secret");
  });

  it("refuses to send without a resolved address", async () => {
    const transport: MailTransport = {
      async sendMail() {
        return { messageId: "unused" };
      },
    };
    const { logger } = createMemoryLogger();
    const adapter = new SmtpEmailAdapter(transport, "from@example.test", logger);
    await expect(adapter.send(delivery({ address: null }))).rejects.toMatchObject({
      code: "internal",
    });
  });

  it("refuses non-email content without calling the transport", async () => {
    const sent: unknown[] = [];
    const transport: MailTransport = {
      async sendMail(message) {
        sent.push(message);
        return { messageId: "unused" };
      },
    };
    const { logger } = createMemoryLogger();
    const adapter = new SmtpEmailAdapter(transport, "from@example.test", logger);
    await expect(
      adapter.send(delivery({ content: { kind: "sms", text: "hi" } })),
    ).rejects.toMatchObject({ code: "internal" });
    expect(sent).toHaveLength(0);
  });

  it("sanitizes a transport failure to a non-PII internal error carrying only the code", async () => {
    const transport: MailTransport = {
      async sendMail() {
        throw Object.assign(new Error("550 <pat@example.com>: recipient rejected"), {
          code: "EENVELOPE",
        });
      },
    };
    const { logger } = createMemoryLogger();
    const adapter = new SmtpEmailAdapter(transport, "from@example.test", logger);
    const thrown = await adapter.send(delivery()).catch((error: unknown) => error);
    expect(thrown).toMatchObject({ code: "internal" });
    const message = thrown instanceof Error ? thrown.message : String(thrown);
    expect(message).toContain("EENVELOPE");
    expect(message).not.toContain("pat@example.com");
  });
});
