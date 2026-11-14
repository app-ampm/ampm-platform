import { useState, type ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

import { useAssignableRoles, useDeleteRole } from "@ampm/api-client";
import type { RoleView } from "@ampm/core";
import {
  Button,
  Card,
  ConfirmSheet,
  DataTable,
  EmptyState,
  QueryErrorState,
  Row,
  Screen,
  ScreenHeader,
  Skeleton,
  SplitPane,
  Stack,
  StatusChip,
  Text,
  useLayoutAt,
  useToast,
  type DataTableColumn,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";
import { AdminSectionNav } from "./admin-section-nav";
import { RoleDetailPanel } from "./role-detail-panel";
import { RoleDetailSheet } from "./role-detail-sheet";
import { RoleEditSheet } from "./role-edit-sheet";
import { roleSummary, roleTypeLabel, roleTypeTone } from "./roles.format";

const COLUMNS: DataTableColumn<RoleView>[] = [
  {
    key: "role",
    header: "Role",
    width: 220,
    grow: true,
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

interface RolesBodyProps {
  readonly roles: UseQueryResult<RoleView[]>;
  readonly onOpen: (role: RoleView) => void;
  /** The role open in the side column, marked in the table; none while it opens on a sheet. */
  readonly openId: string | undefined;
}

function RolesBody({ roles, onOpen, openId }: RolesBodyProps) {
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
        selectedKey={openId}
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

/** The confirmation before a custom role is deleted. */
function RoleDeleteConfirm({ editor }: { readonly editor: ReturnType<typeof useRolesEditor> }) {
  return (
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
  );
}

export interface RolesScreenProps {
  readonly tabBar?: ReactNode;
}

/** The page's gold action: create a custom role. */
function NewRoleButton({ onPress }: { readonly onPress: () => void }) {
  return (
    <Button variant="primary" size="sm" icon="plus" onPress={onPress} testID="role-new">
      New role
    </Button>
  );
}

/** The title with the section strip at its right; New role sits beside the title on a phone only. */
function RolesHeader({ newRole }: { readonly newRole: ReactNode }) {
  return (
    <ScreenHeader
      eyebrow="Admin console"
      title="Roles and permissions"
      trailing={newRole}
      actions={<AdminSectionNav current="roles" />}
    />
  );
}

/**
 * The roles-and-permissions surface (TW-91, T12): every role in a table (pick one for its
 * permissions, grouped by module), plus the custom-role editor (D-036) — a Super Admin creates a role
 * from the capability pick-list, and edits or deletes a custom one from its detail. System roles are
 * read-only. All of it is Super-Admin only, gated server-side.
 *
 * The picked role opens on a sheet below 1024 and in T12's 300 side column from there. The pick is
 * held here, above that switch, so crossing 1024 keeps it open in whichever form fits. New role sits
 * beside the title on a phone and above the table from 768, where the strip takes the header's right.
 *
 *   <RolesScreen tabBar={<AppTabBar />} />
 */
export function RolesScreen({ tabBar }: RolesScreenProps) {
  const roles = useAssignableRoles();
  const editor = useRolesEditor();
  const isTablet = useLayoutAt("md");
  const isDesktop = useLayoutAt("lg");
  const newRole = <NewRoleButton onPress={editor.startCreate} />;
  const openId = isDesktop ? editor.selected?.id : undefined;
  const manage = {
    onClose: editor.closeDetail,
    onEdit: editor.startEdit,
    onDelete: editor.startDelete,
  };
  const header = <RolesHeader newRole={isTablet ? undefined : newRole} />;
  return (
    <Screen width="wide" tabBar={tabBar} header={header}>
      <Stack gap={4}>
        {isTablet ? <Row justify="end">{newRole}</Row> : null}
        <SplitPane
          sideWidth="sm"
          side={isDesktop ? <RoleDetailPanel role={editor.selected} {...manage} /> : null}
        >
          <RolesBody roles={roles} onOpen={editor.openDetail} openId={openId} />
        </SplitPane>
      </Stack>
      <RoleDetailSheet role={isDesktop ? null : editor.selected} {...manage} />
      <RoleEditSheet
        open={editor.editing !== null}
        role={editor.editing?.role ?? null}
        onClose={editor.closeEditor}
      />
      <RoleDeleteConfirm editor={editor} />
    </Screen>
  );
}
