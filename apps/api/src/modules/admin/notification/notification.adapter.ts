import type { ExternalChannel, LogFields, Logger, RenderedContent } from "@ampm/core";

/** A provider-neutral delivery request for an external channel (in-app is delivered by the service). */
export interface NotificationDelivery {
  readonly channel: "email" | "whatsapp" | "sms" | "push";
  readonly recipientType: "user" | "guest";
  readonly recipientId: string;
  /** The recipient's delivery address (the email for the email channel), resolved by the service. */
  readonly address: string | null;
  readonly templateKey: string;
  /** The rendered, per-channel content (feature 5.2); the live adapter sends it, the stub ignores it. */
  readonly content: RenderedContent;
}

export interface NotificationResult {
  readonly providerRef: string;
}

/** One adapter per provider (api.md); business logic never imports a provider SDK. */
export interface NotificationAdapter {
  send(delivery: NotificationDelivery): Promise<NotificationResult>;
}

/** The adapter chosen per channel; an unconfigured channel falls back to the console stub (5.3). */
export interface NotificationAdapters {
  for(channel: ExternalChannel): NotificationAdapter;
}

export const NOTIFICATION_ADAPTERS = Symbol("NOTIFICATION_ADAPTERS");

export type AdapterLogger = Pick<Logger, "info">;

/**
 * A provider error can echo the recipient address or the gateway/SMTP response; keep only its non-PII
 * code, so nothing personal reaches the logs or the job driver's error log (security.md). Shared by the
 * notification channel adapters (reuse-first, code.md).
 */
export function providerErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return "unknown";
}

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
