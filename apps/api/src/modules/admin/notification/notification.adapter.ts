import type { LogFields, Logger } from "@ampm/core";

/** A provider-neutral delivery request for an external channel (in-app is delivered by the service). */
export interface NotificationDelivery {
  readonly channel: "email" | "whatsapp" | "sms" | "push";
  readonly recipientType: "user" | "guest";
  /** The recipient's id; the live adapter resolves the address (email, phone, token) from it. */
  readonly recipientId: string;
  readonly templateKey: string;
  /** The rendered message; sprint 3 renders a trivial string, real templates land in sprint 5. */
  readonly body: string;
}

export interface NotificationResult {
  readonly providerRef: string;
}

/** One adapter per provider (api.md); business logic never imports a provider SDK. */
export interface NotificationAdapter {
  send(delivery: NotificationDelivery): Promise<NotificationResult>;
}

export const NOTIFICATION_ADAPTER = Symbol("NOTIFICATION_ADAPTER");

type AdapterLogger = Pick<Logger, "info">;

/**
 * Development and tests, and the placeholder for every external channel until the live providers
 * land in sprint 5 (SES for email, a WhatsApp BSP, a DLT SMS provider, push): it logs that a
 * delivery happened and returns a synthetic provider reference instead of sending anything. It logs
 * the channel and template only — never the body or the recipient (no personal data in logs,
 * security.md).
 */
export class ConsoleNotificationAdapter implements NotificationAdapter {
  constructor(private readonly logger: AdapterLogger) {}

  async send(delivery: NotificationDelivery): Promise<NotificationResult> {
    const fields: LogFields = { channel: delivery.channel, templateKey: delivery.templateKey };
    this.logger.info("notification.console_delivery", fields);
    return { providerRef: `console:${delivery.channel}:${delivery.templateKey}` };
  }
}
