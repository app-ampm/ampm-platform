import type { RoleView } from "@ampm/core";
import { Sheet } from "@ampm/ui";

import { RoleDetail, RoleManageActions } from "./role-detail";

export interface RoleDetailSheetProps {
  readonly role: RoleView | null;
  readonly onClose: () => void;
  /** Provided where custom roles can be managed; a system role is always read-only. */
  readonly onEdit?: ((role: RoleView) => void) | undefined;
  readonly onDelete?: ((role: RoleView) => void) | undefined;
}

/**
 * One role on a sheet, below 1024 (from there it is the roles page's side column): what it can do,
 * and edit and delete for a custom role.
 *
 *   <RoleDetailSheet role={selected} onClose={close} onEdit={edit} onDelete={remove} />
 */
export function RoleDetailSheet({ role, onClose, onEdit, onDelete }: RoleDetailSheetProps) {
  // A footer only where there is something to do: a system role is read-only.
  const footer =
    role && !role.isSystem && onEdit && onDelete ? (
      <RoleManageActions role={role} onEdit={onEdit} onDelete={onDelete} />
    ) : undefined;
  return (
    <Sheet
      open={role !== null}
      onClose={onClose}
      title={role?.name ?? "Role"}
      size="full"
      testID="role-detail"
      footer={footer}
    >
      {role ? <RoleDetail role={role} /> : null}
    </Sheet>
  );
}
