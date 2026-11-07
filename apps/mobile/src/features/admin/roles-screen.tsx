import { useState, type ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

import { useAssignableRoles } from "@ampm/api-client";
import type { RoleView } from "@ampm/core";
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

import { RoleDetailSheet } from "./role-detail-sheet";
import { roleSummary, roleTypeLabel, roleTypeTone } from "./roles.format";

const COLUMNS: DataTableColumn<RoleView>[] = [
  {
    key: "role",
    header: "Role",
    width: 220,
    render: (role) => (
      <Text variant="body" numberOfLines={1}>
        {role.name}
      </Text>
    ),
  },
  {
    key: "type",
    header: "Type",
    width: 110,
    render: (role) => (
      <StatusChip
        label={roleTypeLabel(role.isSystem)}
        tone={roleTypeTone(role.isSystem)}
        size="sm"
      />
    ),
  },
  {
    key: "permissions",
    header: "Permissions",
    width: 140,
    align: "end",
    render: (role) => <Text variant="data">{String(role.capabilities.length)}</Text>,
  },
];

function RolesLoading() {
  return (
    <Stack gap={2} testID="roles-loading">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </Stack>
  );
}

function RolesBody({
  roles,
  onOpen,
}: {
  readonly roles: UseQueryResult<RoleView[]>;
  readonly onOpen: (role: RoleView) => void;
}) {
  const goToSignIn = useGoToSignIn();
  if (roles.isPending) return <RolesLoading />;
  if (roles.isError) {
    return (
      <QueryErrorState
        error={roles.error}
        onRetry={() => void roles.refetch()}
        onSignIn={goToSignIn}
        signIn={{
          title: "Sign in to view roles",
          description: "Your session has ended. Sign in again to continue.",
        }}
      />
    );
  }
  if (roles.data.length === 0) {
    return (
      <EmptyState
        icon="key"
        title="No roles yet"
        description="Roles appear here once they are configured."
      />
    );
  }
  return (
    <Card padding="sm" testID="roles-table">
      <DataTable
        columns={COLUMNS}
        rows={roles.data}
        keyExtractor={(role) => role.id}
        onRowPress={onOpen}
        rowAccessibilityLabel={roleSummary}
      />
    </Card>
  );
}

export interface RolesScreenProps {
  readonly tabBar?: ReactNode;
}

/**
 * The roles-and-permissions viewer (TW-91): every role — the nine built-in system roles and any
 * custom ones — in a table, tap a row for exactly what it can do, grouped by module. The read side of
 * the role surface the staff directory assigns from; Super Admin only, gated server-side.
 *
 *   <RolesScreen tabBar={<AppTabBar />} />
 */
export function RolesScreen({ tabBar }: RolesScreenProps) {
  const roles = useAssignableRoles();
  const [selected, setSelected] = useState<RoleView | null>(null);
  return (
    <Screen
      tabBar={tabBar}
      header={<ScreenHeader eyebrow="Admin console" title="Roles and permissions" />}
    >
      <RolesBody roles={roles} onOpen={setSelected} />
      <RoleDetailSheet role={selected} onClose={() => setSelected(null)} />
    </Screen>
  );
}
