import { createMemoryLogger } from "@ampm/core";
import { describe, expect, it } from "vitest";

import { GatewaySmsAdapter, type SmsTransport } from "./gateway-sms.adapter.js";
import type { NotificationDelivery } from "./notification.adapter.js";

const PHONE = "+919812345678";
const OTP_TEXT = "123456 is your AMPM verification code. Do not share it.";

function delivery(overrides: Partial<NotificationDelivery> = {}): NotificationDelivery {
  return {
    channel: "sms",
    recipientType: "user",
    recipientId: "user-1",
    address: PHONE,
    templateKey: "client.otp",
    content: { kind: "sms", text: OTP_TEXT },
    ...overrides,
  };
}

/**
 * Offline contract test for the gateway SMS adapter (the `*.contract.spec.ts` convention): an injected
 * fake transport stands in for the live DLT provider, so the request the adapter builds, its provider
 * ref, its error sanitisation and its no-personal-data behaviour are proven with no network, no DLT and
 * ₹0. A live 2Factor sandbox test is deferred until the account and DLT template exist.
 */
describe("GatewaySmsAdapter (offline contract)", () => {
  it("sends the rendered sms to the resolved number and returns the provider ref", async () => {
    const sent: unknown[] = [];
    const transport: SmsTransport = {
      async sendSms(message) {
        sent.push(message);
        return { providerRef: "sms-123" };
      },
    };
    const { logger, entries } = createMemoryLogger();
    const adapter = new GatewaySmsAdapter(transport, logger);

    const result = await adapter.send(delivery());

    expect(result.providerRef).toBe("sms-123");
    expect(sent).toEqual([{ to: PHONE, text: OTP_TEXT }]);
    const logged = entries.find((entry) => entry.event === "notification.sms_sent");
    // Exactly these three fields — no recipient number, no OTP text, nothing added (security.md).
    expect(logged?.fields).toEqual({
      channel: "sms",
      templateKey: "client.otp",
      providerRef: "sms-123",
    });
    // Neither the recipient number nor the OTP text reaches the log (no personal data, no OTP, security.md).
    expect(JSON.stringify(entries)).not.toContain(PHONE);
    expect(JSON.stringify(entries)).not.toContain("123456");
  });

  it("refuses an unresolved address (null or empty) without calling the transport", async () => {
    const sent: unknown[] = [];
    const transport: SmsTransport = {
      async sendSms(message) {
        sent.push(message);
        return { providerRef: "unused" };
      },
    };
    const { logger } = createMemoryLogger();
    const adapter = new GatewaySmsAdapter(transport, logger);
    await expect(adapter.send(delivery({ address: null }))).rejects.toMatchObject({
      code: "internal",
    });
    await expect(adapter.send(delivery({ address: "" }))).rejects.toMatchObject({
      code: "internal",
    });
    // An unresolved destination must never reach the gateway — no OTP is ever dialed (security.md).
    expect(sent).toHaveLength(0);
  });

  it("refuses non-sms content without calling the transport", async () => {
    const sent: unknown[] = [];
    const transport: SmsTransport = {
      async sendSms(message) {
        sent.push(message);
        return { providerRef: "unused" };
      },
    };
    const { logger } = createMemoryLogger();
    const adapter = new GatewaySmsAdapter(transport, logger);
    await expect(
      adapter.send(delivery({ content: { kind: "email", subject: "x", html: "x", text: "x" } })),
    ).rejects.toMatchObject({ code: "internal" });
    expect(sent).toHaveLength(0);
  });

  it("sanitizes a transport failure to a non-PII internal error carrying only the code", async () => {
    const transport: SmsTransport = {
      async sendSms() {
        throw Object.assign(new Error(`gateway rejected ${PHONE}: ${OTP_TEXT}`), {
          code: "EGATEWAY",
        });
      },
    };
    const { logger } = createMemoryLogger();
    const adapter = new GatewaySmsAdapter(transport, logger);
    const thrown = await adapter.send(delivery()).catch((error: unknown) => error);
    expect(thrown).toMatchObject({ code: "internal" });
    const message = thrown instanceof Error ? thrown.message : String(thrown);
    expect(message).toContain("EGATEWAY");
    expect(message).not.toContain(PHONE);
    expect(message).not.toContain("123456");
  });
});
