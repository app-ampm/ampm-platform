import type { RoleView } from "@ampm/core";
import { Button, Card, Row, Stack, Text } from "@ampm/ui";

import { RoleDetail, RoleManageActions } from "./role-detail";

export interface RoleDetailPanelProps {
  /** The role picked in the table, or null before one is. */
  readonly role: RoleView | null;
  readonly onClose: () => void;
  readonly onEdit?: ((role: RoleView) => void) | undefined;
  readonly onDelete?: ((role: RoleView) => void) | undefined;
}

/**
 * The roles page's side column from 1024 (T12's 300): the picked role's permissions on glass, with
 * edit and delete for a custom role and a close that clears the pick; a hint before a role is picked.
 * Below 1024 the same role opens on `RoleDetailSheet`.
 *
 *   <RoleDetailPanel role={selected} onClose={close} onEdit={edit} onDelete={remove} />
 */
export function RoleDetailPanel({ role, onClose, onEdit, onDelete }: RoleDetailPanelProps) {
  if (!role) {
    return (
      <Card testID="role-side-panel-empty">
        <Text variant="bodySmall" tone="muted">
          Choose a role to see exactly what it can do.
        </Text>
      </Card>
    );
  }
  return (
    <Card testID="role-side-panel">
      <Stack gap={4}>
        <Row gap={2} justify="between" align="start">
          <Text variant="subheading" accessibilityRole="header" className="flex-1">
            {role.name}
          </Text>
          <Button
            variant="ghost"
            size="sm"
            icon="x"
            accessibilityLabel={`Close ${role.name}`}
            onPress={onClose}
            testID="role-side-panel-close"
          />
        </Row>
        <RoleDetail role={role} />
        <RoleManageActions role={role} onEdit={onEdit} onDelete={onDelete} />
      </Stack>
    </Card>
  );
}
