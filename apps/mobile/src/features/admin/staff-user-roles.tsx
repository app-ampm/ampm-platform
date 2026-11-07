import type { UseQueryResult } from "@tanstack/react-query";

import { useAssignableRoles, useAssignStaffRole, useUnassignStaffRole } from "@ampm/api-client";
import type { RoleView, StaffUserView } from "@ampm/core";
import { Button, Card, Checkbox, Skeleton, Stack, Text, useToast } from "@ampm/ui";

interface RolesBodyProps {
  readonly roles: UseQueryResult<RoleView[]>;
  readonly assignedKeys: readonly string[];
  readonly pending: boolean;
  readonly onToggle: (role: RoleView, assigned: boolean) => void;
}

/** The roles catalogue as a checklist: a box per role, checked when the user holds it. */
function RolesBody({ roles, assignedKeys, pending, onToggle }: RolesBodyProps) {
  if (roles.isPending) {
    return <Skeleton className="h-28 w-full" testID="staff-roles-loading" />;
  }
  if (roles.isError) {
    return (
      <Stack gap={2}>
        <Text variant="bodySmall" tone="muted">
          Could not load the roles.
        </Text>
        <Button variant="ghost" size="sm" onPress={() => void roles.refetch()}>
          Retry
        </Button>
      </Stack>
    );
  }
  return (
    <Stack gap={2}>
      {roles.data.map((role) => {
        const assigned = assignedKeys.includes(role.roleKey);
        return (
          <Checkbox
            key={role.id}
            label={role.name}
            checked={assigned}
            disabled={pending}
            onCheckedChange={() => onToggle(role, assigned)}
            testID={`role-${role.roleKey}`}
          />
        );
      })}
    </Stack>
  );
}

/**
 * Assign or unassign a staff member's roles (TW-90, the "and roles" half): every role as a checkbox,
 * checked when they hold it. Toggling calls the server (which revokes their sessions so the change
 * takes effect at once) and confirms by toast; the record refreshes to the server's truth.
 *
 *   <StaffUserRoles user={user} />
 */
export function StaffUserRoles({ user }: { readonly user: StaffUserView }) {
  const toast = useToast();
  const roles = useAssignableRoles();
  const assign = useAssignStaffRole(user.id);
  const unassign = useUnassignStaffRole(user.id);
  const pending = assign.isPending || unassign.isPending;
  const onError = (): void =>
    void toast.show({ title: "Could not change the role", tone: "danger" });
  const toggle = (role: RoleView, assigned: boolean): void => {
    if (pending) return;
    const added = (): void => void toast.show({ title: `${role.name} added`, tone: "success" });
    const removed = (): void => void toast.show({ title: `${role.name} removed`, tone: "success" });
    if (assigned) unassign.mutate(role.id, { onSuccess: removed, onError });
    else assign.mutate({ roleId: role.id }, { onSuccess: added, onError });
  };
  return (
    <Card className="md:p-6" testID="staff-user-roles">
      <Stack gap={3}>
        <Text variant="subheading">Roles</Text>
        <RolesBody roles={roles} assignedKeys={user.roles} pending={pending} onToggle={toggle} />
      </Stack>
    </Card>
  );
}
