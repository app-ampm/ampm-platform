import { errors, type LogFields } from "@ampm/core";

import {
  type AdapterLogger,
  type NotificationAdapter,
  type NotificationDelivery,
  type NotificationResult,
  providerErrorCode,
} from "./notification.adapter.js";

/** The minimal mail transport the adapter needs; the module wires a nodemailer one, tests a fake. */
export interface MailTransport {
  sendMail(message: {
    readonly from: string;
    readonly to: string;
    readonly subject: string;
    readonly html: string;
    readonly text: string;
  }): Promise<{ readonly messageId: string }>;
}

/**
 * The live email adapter (feature 5.3): sends the rendered email through an injected SMTP transport
 * (Amazon SES over SMTP in staging/production, a local catcher in dev; the module wires it). The
 * provider lib is never imported here — the transport is injected, so the adapter is testable with a
 * fake. Logs the channel, template and provider message id only — never the recipient or the body.
 */
export class SmtpEmailAdapter implements NotificationAdapter {
  constructor(
    private readonly transport: MailTransport,
    private readonly from: string,
    private readonly logger: AdapterLogger,
  ) {}

  async send(delivery: NotificationDelivery): Promise<NotificationResult> {
    if (delivery.content.kind !== "email" || !delivery.address) {
      throw errors.internal("email delivery needs a resolved address and rendered email content");
    }
    const { subject, html, text } = delivery.content;
    let messageId: string;
    try {
      ({ messageId } = await this.transport.sendMail({
        from: this.from,
        to: delivery.address,
        subject,
        html,
        text,
      }));
    } catch (error) {
      // The provider error may echo the recipient address or the message body; drop it and keep only a
      // non-PII code, so nothing personal reaches the logs or the job driver's error log (security.md).
      throw errors.internal(`email delivery failed (${providerErrorCode(error)})`);
    }
    const fields: LogFields = {
      channel: delivery.channel,
      templateKey: delivery.templateKey,
      providerRef: messageId,
    };
    this.logger.info("notification.email_sent", fields);
    return { providerRef: messageId };
  }
}
