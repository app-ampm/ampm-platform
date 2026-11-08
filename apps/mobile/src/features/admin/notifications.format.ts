import type { NotificationChannel, NotificationStatus, NotificationView } from "@ampm/core";
import type { StatusTone } from "@ampm/ui";

import { formatMoment } from "./audit-log.format";

/*
 * Presentation helpers for the notifications log (TW-91): the label per channel, the chip treatment per
 * delivery status, and a readable template name. No fetching, no rules.
 */

// A notification's timestamps read in the same device-time form as the audit log's; re-exported so a
// notification screen imports every one of its formatters from this one module.
export { formatMoment };

const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  in_app: "In-app",
  email: "Email",
  whatsapp: "WhatsApp",
  sms: "SMS",
  push: "Push",
};

export function notificationChannelLabel(channel: NotificationChannel): string {
  return CHANNEL_LABEL[channel];
}

const STATUS_LABEL: Record<NotificationStatus, string> = {
  queued: "Queued",
  sent: "Sent",
  delivered: "Delivered",
  failed: "Failed",
  read: "Read",
};

/** Peacock once delivered or read, gold for a failure, outline while it is still on its way. */
const STATUS_TONE: Record<NotificationStatus, StatusTone> = {
  queued: "neutral",
  sent: "info",
  delivered: "success",
  failed: "danger",
  read: "success",
};

export function notificationStatusLabel(status: NotificationStatus): string {
  return STATUS_LABEL[status];
}

export function notificationStatusTone(status: NotificationStatus): StatusTone {
  return STATUS_TONE[status];
}

/** A template key as a readable label: "client.invite" → "Client invite". */
export function notificationTemplateLabel(templateKey: string): string {
  const words = templateKey.replace(/[._-]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : templateKey;
}

/** A screen-reader summary of one notification row. */
export function notificationSummary(notification: NotificationView): string {
  return `${notificationTemplateLabel(notification.templateKey)} by ${notificationChannelLabel(
    notification.channel,
  )}, ${notificationStatusLabel(notification.status)}, ${formatMoment(notification.createdAt)}`;
}
