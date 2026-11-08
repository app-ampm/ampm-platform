import { useState, type ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

import { useAssignableRoles, useDeleteRole } from "@ampm/api-client";
import type { RoleView } from "@ampm/core";
import {
  Button,
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
  useToast,
  type DataTableColumn,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { ConfirmSheet } from "./confirm-sheet";
import { RoleDetailSheet } from "./role-detail-sheet";
import { RoleEditSheet } from "./role-edit-sheet";
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

interface Editing {
  readonly role: RoleView | null;
}

/** The detail / create / edit / delete sheet state for the custom-role editor, kept out of the view. */
function useRolesEditor() {
  const toast = useToast();
  const remove = useDeleteRole();
  const [selected, setSelected] = useState<RoleView | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<RoleView | null>(null);
  const confirmDelete = (): void => {
    if (!deleting || remove.isPending) return;
    const { id, name } = deleting;
    remove.mutate(id, {
      onSuccess: () => {
        toast.show({ title: `${name} deleted`, tone: "success" });
        setDeleting(null);
      },
      onError: () => toast.show({ title: "Could not delete the role", tone: "danger" }),
    });
  };
  return {
    selected,
    editing,
    deleting,
    deletePending: remove.isPending,
    openDetail: (role: RoleView): void => setSelected(role),
    closeDetail: (): void => setSelected(null),
    startCreate: (): void => setEditing({ role: null }),
    startEdit: (role: RoleView): void => {
      setSelected(null);
      setEditing({ role });
    },
    startDelete: (role: RoleView): void => {
      setSelected(null);
      setDeleting(role);
    },
    closeEditor: (): void => setEditing(null),
    cancelDelete: (): void => setDeleting(null),
    confirmDelete,
  };
}

export interface RolesScreenProps {
  readonly tabBar?: ReactNode;
}

/**
 * The roles-and-permissions surface (TW-91): every role in a table (tap for its permissions, grouped
 * by module), plus the custom-role editor (D-036) — a Super Admin creates a role from the capability
 * pick-list, and edits or deletes a custom one from its detail sheet. System roles are read-only. All
 * of it is Super-Admin only, gated server-side.
 *
 *   <RolesScreen tabBar={<AppTabBar />} />
 */
export function RolesScreen({ tabBar }: RolesScreenProps) {
  const roles = useAssignableRoles();
  const editor = useRolesEditor();
  return (
    <Screen
      tabBar={tabBar}
      header={
        <ScreenHeader
          eyebrow="Admin console"
          title="Roles and permissions"
          trailing={
            <Button
              variant="primary"
              size="sm"
              icon="plus"
              onPress={editor.startCreate}
              testID="role-new"
            >
              New role
            </Button>
          }
        />
      }
    >
      <RolesBody roles={roles} onOpen={editor.openDetail} />
      <RoleDetailSheet
        role={editor.selected}
        onClose={editor.closeDetail}
        onEdit={editor.startEdit}
        onDelete={editor.startDelete}
      />
      <RoleEditSheet
        open={editor.editing !== null}
        role={editor.editing?.role ?? null}
        onClose={editor.closeEditor}
      />
      <ConfirmSheet
        open={editor.deleting !== null}
        onClose={editor.cancelDelete}
        title={editor.deleting ? `Delete ${editor.deleting.name}?` : "Delete role?"}
        description="This removes the role for everyone who holds it, and signs them out."
        confirmLabel="Delete role"
        destructive
        loading={editor.deletePending}
        onConfirm={editor.confirmDelete}
        testID="role-delete"
      />
    </Screen>
  );
}
