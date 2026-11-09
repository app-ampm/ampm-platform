import type { ReactNode } from "react";
import { useRouter } from "expo-router";

import { Card, ListItem, Screen, ScreenHeader, Stack } from "@ampm/ui";

export interface AdminConsoleScreenProps {
  /** The app's tab bar (the route supplies it); the screen keeps room for it at the end. */
  readonly tabBar?: ReactNode;
}

/**
 * The admin console landing — the Settings area (TW-90–96): the sections a Super Admin runs the
 * platform from, each opening its own screen. The staff directory (TW-90) is the first; roles,
 * configuration and the audit log follow as they are built, and a section hides where the role may
 * not read it.
 *
 *   <AdminConsoleScreen tabBar={<AppTabBar />} />
 */
export function AdminConsoleScreen({ tabBar }: AdminConsoleScreenProps) {
  const router = useRouter();
  return (
    <Screen tabBar={tabBar} header={<ScreenHeader eyebrow="Admin console" title="Settings" />}>
      <Card padding="sm" testID="admin-sections">
        <Stack gap={2}>
          <ListItem
            title="Users and roles"
            subtitle="Staff accounts, roles, authenticator and access"
            onPress={() => router.push("/admin/users")}
            accessibilityLabel="Users and roles: staff accounts, roles, authenticator and access"
            testID="admin-section-users"
          />
          <ListItem
            title="Roles and permissions"
            subtitle="Every role and exactly what it can do"
            onPress={() => router.push("/admin/roles")}
            accessibilityLabel="Roles and permissions: every role and exactly what it can do"
            testID="admin-section-roles"
          />
          <ListItem
            title="Notifications"
            subtitle="Every notice the platform sent, and how it was delivered"
            onPress={() => router.push("/admin/notifications")}
            accessibilityLabel="Notifications: every notice the platform sent, and how it was delivered"
            testID="admin-section-notifications"
          />
          <ListItem
            title="Notification templates"
            subtitle="The message templates sent on each channel"
            onPress={() => router.push("/admin/notification-templates")}
            accessibilityLabel="Notification templates: the message templates sent on each channel"
            testID="admin-section-notification-templates"
          />
          <ListItem
            title="Configuration"
            subtitle="Platform thresholds, policies and feature switches"
            onPress={() => router.push("/admin/configuration")}
            accessibilityLabel="Configuration: platform thresholds, policies and feature switches"
            testID="admin-section-configuration"
          />
          <ListItem
            title="Audit log"
            subtitle="The append-only history of every change"
            onPress={() => router.push("/admin/audit")}
            accessibilityLabel="Audit log: the append-only history of every change"
            testID="admin-section-audit"
          />
        </Stack>
      </Card>
    </Screen>
  );
}
