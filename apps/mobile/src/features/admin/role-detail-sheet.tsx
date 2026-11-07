import type { CapabilityView, RoleView } from "@ampm/core";
import { Row, Sheet, Stack, StatusChip, Text } from "@ampm/ui";

import {
  capabilityGroups,
  permissionCountLabel,
  roleTypeLabel,
  roleTypeTone,
} from "./roles.format";

/** One capability, with a tag when it is an escalation-locked (administrative) power. */
function CapabilityRow({ capability }: { readonly capability: CapabilityView }) {
  return (
    <Row gap={2} justify="between" accessible accessibilityLabel={capability.label}>
      <Text variant="bodySmall" tone="body" className="flex-1">
        {capability.label}
      </Text>
      {capability.isEscalationLocked ? (
        <StatusChip label="Elevated" tone="warning" size="sm" />
      ) : null}
    </Row>
  );
}

/** One module's capabilities under its heading and count. */
function ModuleGroup({
  label,
  capabilities,
}: {
  readonly label: string;
  readonly capabilities: readonly CapabilityView[];
}) {
  return (
    <Stack gap={2}>
      <Row gap={2} justify="between">
        <Text variant="eyebrow" tone="muted">
          {label}
        </Text>
        <Text variant="eyebrow" tone="muted">
          {String(capabilities.length)}
        </Text>
      </Row>
      <Stack gap={2}>
        {capabilities.map((capability) => (
          <CapabilityRow key={capability.id} capability={capability} />
        ))}
      </Stack>
    </Stack>
  );
}

export interface RoleDetailSheetProps {
  readonly role: RoleView | null;
  readonly onClose: () => void;
}

/** What one role can do: its kind, how many permissions it grants, and every one grouped by module. */
export function RoleDetailSheet({ role, onClose }: RoleDetailSheetProps) {
  const groups = role ? capabilityGroups(role.capabilities) : [];
  return (
    <Sheet
      open={role !== null}
      onClose={onClose}
      title={role?.name ?? "Role"}
      size="full"
      testID="role-detail"
    >
      {role ? (
        <Stack gap={4}>
          <Row gap={2}>
            <StatusChip
              label={roleTypeLabel(role.isSystem)}
              tone={roleTypeTone(role.isSystem)}
              size="sm"
            />
            <Text variant="bodySmall" tone="muted">
              {permissionCountLabel(role.capabilities.length)}
            </Text>
          </Row>
          {groups.length === 0 ? (
            <Text variant="bodySmall" tone="muted">
              This role grants no permissions.
            </Text>
          ) : (
            groups.map((group) => (
              <ModuleGroup
                key={group.module}
                label={group.label}
                capabilities={group.capabilities}
              />
            ))
          )}
        </Stack>
      ) : null}
    </Sheet>
  );
}
