import { errors, type LogFields } from "@ampm/core";

import {
  type AdapterLogger,
  type NotificationAdapter,
  type NotificationDelivery,
  type NotificationResult,
  providerErrorCode,
} from "./notification.adapter.js";

/**
 * The minimal SMS gateway transport the adapter needs; the module wires a real HTTP client (a
 * DLT-registered Indian provider — 2Factor first, MSG91 the documented fallback; SMS/OTP audit,
 * docs/engineering/sms-otp-provider-audit.md), tests inject a fake. Vendor-neutral, so a provider swap
 * is a transport change, not an adapter change (api.md). On success it resolves a non-empty provider
 * reference (the message handle used for delivery correlation and idempotency, api.md); on any gateway
 * or network error it throws, and the adapter sanitises that to a non-PII code.
 */
export interface SmsTransport {
  sendSms(message: {
    readonly to: string;
    readonly text: string;
  }): Promise<{ readonly providerRef: string }>;
}

/**
 * The live SMS adapter (the client-OTP channel and the `sms` notification channel; SMS/OTP audit,
 * docs/engineering/sms-otp-provider-audit.md): sends the rendered SMS through an injected HTTP gateway
 * transport. The provider lib is never imported here — the transport is injected, so the adapter is
 * proven offline with a fake and a provider swap stays contained (api.md). Logs the channel, template
 * and provider ref only — never the recipient number or the message text (no personal data, no OTP in
 * logs, security.md).
 */
export class GatewaySmsAdapter implements NotificationAdapter {
  constructor(
    private readonly transport: SmsTransport,
    private readonly logger: AdapterLogger,
  ) {}

  async send(delivery: NotificationDelivery): Promise<NotificationResult> {
    if (delivery.content.kind !== "sms" || !delivery.address) {
      throw errors.internal("sms delivery needs a resolved address and rendered sms content");
    }
    let providerRef: string;
    try {
      ({ providerRef } = await this.transport.sendSms({
        to: delivery.address,
        text: delivery.content.text,
      }));
    } catch (error) {
      // The gateway error may echo the recipient number or the OTP text; drop it and keep only a
      // non-PII code, so nothing personal reaches the logs or the job driver's error log (security.md).
      throw errors.internal(`sms delivery failed (${providerErrorCode(error)})`);
    }
    const fields: LogFields = {
      channel: delivery.channel,
      templateKey: delivery.templateKey,
      providerRef,
    };
    this.logger.info("notification.sms_sent", fields);
    return { providerRef };
  }
}
