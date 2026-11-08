import type { NotificationView } from "@ampm/core";
import { Sheet, Stack, Text } from "@ampm/ui";

import {
  formatMoment,
  notificationChannelLabel,
  notificationStatusLabel,
  notificationTemplateLabel,
} from "./notifications.format";

function Field({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <Stack gap={1} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="eyebrow" tone="muted">
        {label}
      </Text>
      <Text variant="bodySmall" tone="primary">
        {value}
      </Text>
    </Stack>
  );
}

function entityValue(notification: NotificationView): string {
  if (!notification.entityType) return "—";
  return notification.entityId
    ? `${notification.entityType} · ${notification.entityId}`
    : notification.entityType;
}

function moment(iso: string | null): string {
  return iso ? formatMoment(iso) : "—";
}

export interface NotificationDetailSheetProps {
  readonly notification: NotificationView | null;
  readonly onClose: () => void;
}

/** The full record for one notification: channel, template, status, the entity it is about, and the
 * queued/sent/delivered timestamps. The display text itself is rendered by the recipient's app from
 * the template, so it is not carried here. */
export function NotificationDetailSheet({ notification, onClose }: NotificationDetailSheetProps) {
  return (
    <Sheet
      open={notification !== null}
      onClose={onClose}
      title="Notification"
      size="full"
      testID="notification-detail"
    >
      {notification ? (
        <Stack gap={3}>
          <Field label="Channel" value={notificationChannelLabel(notification.channel)} />
          <Field label="Template" value={notificationTemplateLabel(notification.templateKey)} />
          <Field label="Status" value={notificationStatusLabel(notification.status)} />
          <Field label="About" value={entityValue(notification)} />
          <Field label="Created" value={formatMoment(notification.createdAt)} />
          <Field label="Sent" value={moment(notification.sentAt)} />
          <Field label="Delivered" value={moment(notification.deliveredAt)} />
        </Stack>
      ) : null}
    </Sheet>
  );
}
