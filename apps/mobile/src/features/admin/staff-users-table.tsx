import type { StaffUserView } from "@ampm/core";
import { Card, DataTable, StatusChip, Text, type DataTableColumn } from "@ampm/ui";

import {
  authenticatorLabel,
  authenticatorTone,
  lastSignInLabel,
  roleSummary,
  staffUserSummary,
  userStatusLabel,
  userStatusTone,
} from "./admin.format";

// The phone row's facts as columns: the name takes the spare width; the authenticator chip keeps
// what the phone row shows beside the status.
const COLUMNS: DataTableColumn<StaffUserView>[] = [
  {
    key: "name",
    header: "Name",
    width: 180,
    grow: true,
    render: (user) => (
      <Text variant="body" numberOfLines={1}>
        {user.name}
      </Text>
    ),
  },
  {
    key: "email",
    header: "Email",
    width: 220,
    render: (user) => (
      <Text variant="bodySmall" tone="body" numberOfLines={1}>
        {user.email}
      </Text>
    ),
  },
  {
    key: "roles",
    header: "Roles",
    width: 230,
    render: (user) => (
      <Text variant="bodySmall" tone="body" numberOfLines={1}>
        {roleSummary(user.roles)}
      </Text>
    ),
  },
  {
    key: "status",
    header: "Status",
    width: 110,
    render: (user) => (
      <StatusChip
        label={userStatusLabel(user.status)}
        tone={userStatusTone(user.status)}
        size="sm"
      />
    ),
  },
  {
    key: "authenticator",
    header: "Authenticator",
    width: 170,
    render: (user) => (
      <StatusChip
        label={authenticatorLabel(user.mfaEnabled)}
        tone={authenticatorTone(user.mfaEnabled)}
        size="sm"
      />
    ),
  },
  {
    key: "last-sign-in",
    header: "Last sign-in",
    width: 130,
    align: "end",
    render: (user) => <Text variant="data">{lastSignInLabel(user.lastLoginAt)}</Text>,
  },
];

export interface StaffUsersTableProps {
  /** The loaded staff users, newest first. */
  readonly users: readonly StaffUserView[];
  readonly onOpen: (userId: string) => void;
}

/**
 * The staff directory as a table on glass (TW-90, from 768): name, email, roles, status,
 * authenticator and last sign-in; a row opens the person's record. A phone keeps the rows of
 * `StaffUsersList`.
 *
 *   <StaffUsersTable users={page.items} onOpen={openUser} />
 */
export function StaffUsersTable({ users, onOpen }: StaffUsersTableProps) {
  return (
    <Card padding="sm" testID="staff-users-table">
      <DataTable
        columns={COLUMNS}
        rows={users}
        keyExtractor={(user) => user.id}
        onRowPress={(user) => onOpen(user.id)}
        rowAccessibilityLabel={(user) => `${user.name}: ${staffUserSummary(user)}`}
      />
    </Card>
  );
}
