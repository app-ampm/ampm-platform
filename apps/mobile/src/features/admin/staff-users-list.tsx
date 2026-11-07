import type { StaffUserView } from "@ampm/core";
import { Card, ListItem, Stack, StatusChip } from "@ampm/ui";

import {
  authenticatorLabel,
  authenticatorTone,
  lastSignInLabel,
  roleSummary,
  staffUserSummary,
  userStatusLabel,
  userStatusTone,
} from "./admin.format";

export interface StaffUsersListProps {
  /** The loaded staff users, newest first. */
  readonly users: readonly StaffUserView[];
  readonly onOpen: (userId: string) => void;
}

/** The roles and the last sign-in as one data line: "Sales Manager · Last sign-in 2 NOV 2026". */
function rowMeta(user: StaffUserView): string {
  return `${roleSummary(user.roles)} · Last sign-in ${lastSignInLabel(user.lastLoginAt)}`;
}

/** The account status and the authenticator state, stacked at the end of the row. */
function RowChips({ user }: { readonly user: StaffUserView }) {
  return (
    <Stack gap={1} align="end">
      <StatusChip
        label={userStatusLabel(user.status)}
        tone={userStatusTone(user.status)}
        size="sm"
      />
      <StatusChip
        label={authenticatorLabel(user.mfaEnabled)}
        tone={authenticatorTone(user.mfaEnabled)}
        size="sm"
      />
    </Stack>
  );
}

/**
 * The staff directory as a glass panel of rows (TW-90): each shows the person, their roles and last
 * sign-in, with status and authenticator chips, and opens their record.
 *
 *   <StaffUsersList users={page.items} onOpen={openUser} />
 */
export function StaffUsersList({ users, onOpen }: StaffUsersListProps) {
  return (
    <Card padding="sm" testID="staff-users-list">
      <Stack gap={2}>
        {users.map((user) => (
          <ListItem
            key={user.id}
            title={user.name}
            subtitle={user.email}
            meta={rowMeta(user)}
            trailing={<RowChips user={user} />}
            onPress={() => onOpen(user.id)}
            accessibilityLabel={`${user.name}: ${staffUserSummary(user)}`}
            testID={`staff-user-row-${user.id}`}
          />
        ))}
      </Stack>
    </Card>
  );
}
