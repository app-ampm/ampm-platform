import { z } from "zod";

import { isoDateTime, uuid } from "./common";

/** The delivery channels of a notification (`notifications.channel`, data-model.md). */
export const notificationChannel = z.enum(["in_app", "email", "whatsapp", "sms", "push"]);
export type NotificationChannel = z.infer<typeof notificationChannel>;

/** Its lifecycle (`notifications.status`): queued → sent → delivered → read, or → failed. */
export const notificationStatus = z.enum(["queued", "sent", "delivered", "failed", "read"]);
export type NotificationStatus = z.infer<typeof notificationStatus>;

/** Who a notification is addressed to (`notifications.recipient_type`): any user, or a guest token. */
export const recipientType = z.enum(["user", "guest"]);
export type RecipientType = z.infer<typeof recipientType>;

/**
 * One notification as its recipient sees it (`GET /notifications`). The display text is rendered by
 * the app from the template and the entity, so no internal field is carried here.
 *
 * @example
 * return page(notificationView).parse({ items, nextCursor });
 */
export const notificationView = z.object({
  id: uuid,
  channel: notificationChannel,
  templateKey: z.string(),
  status: notificationStatus,
  entityType: z.string().nullable(),
  entityId: uuid.nullable(),
  createdAt: isoDateTime,
  sentAt: isoDateTime.nullable(),
  deliveredAt: isoDateTime.nullable(),
});
export type NotificationView = z.infer<typeof notificationView>;
