import { useState, type ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

import { useNotifications } from "@ampm/api-client";
import type { NotificationPage, NotificationView } from "@ampm/core";
import {
  Card,
  DataTable,
  EmptyState,
  QueryErrorState,
  Screen,
  ScreenHeader,
  Skeleton,
  Stack,
  StatusChip,
  Text,
  type DataTableColumn,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { NotificationDetailSheet } from "./notification-detail-sheet";
import {
  formatMoment,
  notificationChannelLabel,
  notificationStatusLabel,
  notificationStatusTone,
  notificationSummary,
  notificationTemplateLabel,
} from "./notifications.format";

const COLUMNS: DataTableColumn<NotificationView>[] = [
  {
    key: "when",
    header: "When",
    width: 170,
    render: (notification) => <Text variant="data">{formatMoment(notification.createdAt)}</Text>,
  },
  {
    key: "channel",
    header: "Channel",
    width: 100,
    render: (notification) => (
      <Text variant="bodySmall">{notificationChannelLabel(notification.channel)}</Text>
    ),
  },
  {
    key: "template",
    header: "Template",
    width: 180,
    render: (notification) => (
      <Text variant="bodySmall" numberOfLines={1}>
        {notificationTemplateLabel(notification.templateKey)}
      </Text>
    ),
  },
  {
    key: "status",
    header: "Status",
    width: 120,
    render: (notification) => (
      <StatusChip
        label={notificationStatusLabel(notification.status)}
        tone={notificationStatusTone(notification.status)}
        size="sm"
      />
    ),
  },
];

function notificationsEyebrow(page: NotificationPage | undefined): string {
  if (!page) return "Admin console";
  return `Notifications · ${page.items.length}${page.nextCursor ? "+" : ""}`;
}

function NotificationsLoading() {
  return (
    <Stack gap={2} testID="notifications-loading">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </Stack>
  );
}

interface BodyProps {
  readonly notifications: UseQueryResult<NotificationPage>;
  readonly onOpen: (notification: NotificationView) => void;
}

function NotificationsBody({ notifications, onOpen }: BodyProps) {
  const goToSignIn = useGoToSignIn();
  if (notifications.isPending) return <NotificationsLoading />;
  if (notifications.isError) {
    return (
      <QueryErrorState
        error={notifications.error}
        onRetry={() => void notifications.refetch()}
        onSignIn={goToSignIn}
        signIn={{
          title: "Sign in to view notifications",
          description: "Your session has ended. Sign in again to continue.",
        }}
      />
    );
  }
  if (notifications.data.items.length === 0) {
    return (
      <EmptyState
        icon="bell"
        title="No notifications yet"
        description="Notices sent across the platform's channels appear here as they go out."
      />
    );
  }
  return (
    <Card padding="sm" testID="notifications-table">
      <DataTable
        columns={COLUMNS}
        rows={notifications.data.items}
        keyExtractor={(notification) => notification.id}
        onRowPress={onOpen}
        rowAccessibilityLabel={notificationSummary}
      />
    </Card>
  );
}

export interface NotificationsLogScreenProps {
  readonly tabBar?: ReactNode;
}

/**
 * The notifications log (TW-91): the delivery history of every notice the platform sent — channel,
 * template, lifecycle status and timestamps — newest first, in a table. Tap a row for the full
 * record. A normal staff role reads its own notices; the Super Admin reads the whole log (the server
 * is the gate, by `admin.notifications.read` scope). Filters by channel/status/date are a later slice.
 *
 *   <NotificationsLogScreen tabBar={<AppTabBar />} />
 */
export function NotificationsLogScreen({ tabBar }: NotificationsLogScreenProps) {
  const notifications = useNotifications();
  const [selected, setSelected] = useState<NotificationView | null>(null);
  return (
    <Screen
      tabBar={tabBar}
      header={
        <ScreenHeader eyebrow={notificationsEyebrow(notifications.data)} title="Notifications" />
      }
    >
      <NotificationsBody notifications={notifications} onOpen={setSelected} />
      <NotificationDetailSheet notification={selected} onClose={() => setSelected(null)} />
    </Screen>
  );
}
