import { useEffect, useState } from "react";

import { useCreateRole, useUpdateRole } from "@ampm/api-client";
import type { RoleView } from "@ampm/core";
import { Button, Input, Sheet, Stack, useToast } from "@ampm/ui";

import { CapabilityPicker } from "./capability-picker";

interface RoleDraft {
  readonly name: string;
  readonly capabilityIds: readonly string[];
}

/** Edit starts from the role's current name and capabilities; create starts empty. */
function draftFromRole(role: RoleView | null): RoleDraft {
  return role
    ? { name: role.name, capabilityIds: role.capabilities.map((capability) => capability.id) }
    : { name: "", capabilityIds: [] };
}

/** The create/edit form's state, validation and submission; kept out of the view so each stays small. */
function useRoleForm(open: boolean, role: RoleView | null, onClose: () => void) {
  const toast = useToast();
  const create = useCreateRole();
  const update = useUpdateRole();
  const [draft, setDraft] = useState<RoleDraft>(() => draftFromRole(role));
  const [showErrors, setShowErrors] = useState(false);
  // Re-seed the draft each time the sheet opens, so "New role" starts clean and editing a role shows
  // its current name and capabilities.
  useEffect(() => {
    if (open) {
      setDraft(draftFromRole(role));
      setShowErrors(false);
    }
  }, [open, role]);
  const name = draft.name.trim();
  const pending = create.isPending || update.isPending;
  const onError = (): void => void toast.show({ title: "Could not save the role", tone: "danger" });
  const onSuccess = (): void => {
    toast.show({ title: role ? "Role updated" : "Role created", tone: "success" });
    onClose();
  };
  const submit = (): void => {
    if (pending) return;
    if (name.length === 0) return setShowErrors(true);
    const body = { name, capabilityIds: [...draft.capabilityIds] };
    if (role) update.mutate({ roleId: role.id, body }, { onSuccess, onError });
    else create.mutate(body, { onSuccess, onError });
  };
  return {
    draft,
    setName: (value: string): void => setDraft((prev) => ({ ...prev, name: value })),
    setCapabilities: (ids: string[]): void => setDraft((prev) => ({ ...prev, capabilityIds: ids })),
    nameError: showErrors && name.length === 0 ? "Give the role a name" : undefined,
    pending,
    submit,
  };
}

export interface RoleEditSheetProps {
  readonly open: boolean;
  /** The custom role being edited, or null to create a new one. */
  readonly role: RoleView | null;
  readonly onClose: () => void;
}

/**
 * Create a custom role, or edit one (D-036): a name and a multi-select of the catalog capabilities a
 * custom role may hold. The server generates the role key and enforces that only assignable (never
 * escalation-locked) capabilities are granted; this is the Super-Admin editor over that surface.
 *
 *   <RoleEditSheet open={open} role={editing} onClose={close} />
 */
export function RoleEditSheet({ open, role, onClose }: RoleEditSheetProps) {
  const { draft, setName, setCapabilities, nameError, pending, submit } = useRoleForm(
    open,
    role,
    onClose,
  );
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={role ? "Edit custom role" : "New custom role"}
      size="full"
      testID="role-edit"
      footer={
        <Button fullWidth loading={pending} onPress={submit} testID="role-edit-submit">
          {role ? "Save changes" : "Create role"}
        </Button>
      }
    >
      <Stack gap={4}>
        <Input
          label="Role name"
          required
          value={draft.name}
          onChangeText={setName}
          placeholder="e.g. Finance viewer"
          errorText={nameError}
          autoCapitalize="words"
          testID="role-name"
        />
        {/* Mount the 600+-capability picker only while open, so it never fetches in the background. */}
        {open ? <CapabilityPicker value={draft.capabilityIds} onChange={setCapabilities} /> : null}
      </Stack>
    </Sheet>
  );
}
