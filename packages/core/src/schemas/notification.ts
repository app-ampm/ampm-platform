import { z } from "zod";

import { isoDateTime, page, uuid } from "./common";

/** The delivery channels of a notification (`notifications.channel`, data-model.md). */
export const notificationChannel = z.enum(["in_app", "email", "whatsapp", "sms", "push"]);
export type NotificationChannel = z.infer<typeof notificationChannel>;

/** Its lifecycle (`notifications.status`): queued → sent → delivered → read, or → failed. */
export const notificationStatus = z.enum(["queued", "sent", "delivered", "failed", "read"]);
export type NotificationStatus = z.infer<typeof notificationStatus>;

/**
 * Who a notification is addressed to (`notifications.recipient_type`): any user, a guest token, or an
 * external recipient outside AMPM (D-188 §5), such as a hotel's contact, whose `recipient_id` is the record
 * the notice is about and whose address the row holds until it leaves `queued`.
 */
export const recipientType = z.enum(["user", "guest", "external"]);
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

/** A page of notifications (`GET /notifications`), cursor-paginated newest first. */
export const notificationPage = page(notificationView);
export type NotificationPage = z.infer<typeof notificationPage>;
