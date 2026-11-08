import { useState } from "react";
import { Pressable } from "react-native";
import type { UseQueryResult } from "@tanstack/react-query";

import { useCapabilities } from "@ampm/api-client";
import type { CapabilityView } from "@ampm/core";
import { Button, Checkbox, Icon, Row, Skeleton, Stack, Text } from "@ampm/ui";

import { capabilityGroups, type CapabilityGroup } from "./roles.format";

interface ModuleSectionProps {
  readonly group: CapabilityGroup;
  readonly selected: ReadonlySet<string>;
  readonly expanded: boolean;
  readonly onToggleExpand: () => void;
  readonly onToggleCapability: (id: string) => void;
}

/** One module: a tappable header with its selected count, revealing its capabilities when expanded. */
function ModuleSection({
  group,
  selected,
  expanded,
  onToggleExpand,
  onToggleCapability,
}: ModuleSectionProps) {
  const count = group.capabilities.filter((capability) => selected.has(capability.id)).length;
  return (
    <Stack gap={2}>
      <Pressable
        onPress={onToggleExpand}
        accessibilityRole="button"
        // `aria-expanded` is written on web (react-native-web drops `accessibilityState`) and React
        // Native maps it to the native expanded state, as nav-rail-item.tsx does for the same reason.
        aria-expanded={expanded}
        accessibilityLabel={`${group.label}, ${count} of ${group.capabilities.length} selected`}
        testID={`capability-module-${group.module}`}
      >
        <Row gap={2} justify="between" className="min-h-touch">
          <Text variant="subheading">{group.label}</Text>
          <Row gap={2}>
            <Text variant="bodySmall" tone="muted">
              {count}/{group.capabilities.length}
            </Text>
            <Icon name={expanded ? "chevron-up" : "chevron-down"} size="sm" tone="muted" />
          </Row>
        </Row>
      </Pressable>
      {expanded ? (
        <Stack gap={2} className="pl-2">
          {group.capabilities.map((capability) => (
            <Checkbox
              key={capability.id}
              label={capability.label}
              checked={selected.has(capability.id)}
              onCheckedChange={() => onToggleCapability(capability.id)}
              testID={`capability-${capability.id}`}
            />
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}

interface PickerBodyProps {
  readonly capabilities: UseQueryResult<CapabilityView[]>;
  readonly value: readonly string[];
  readonly onChange: (ids: string[]) => void;
}

function PickerBody({ capabilities, value, onChange }: PickerBodyProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set<string>());
  if (capabilities.isPending) {
    return <Skeleton className="h-28 w-full" testID="capabilities-loading" />;
  }
  if (capabilities.isError) {
    return (
      <Stack gap={2}>
        <Text variant="bodySmall" tone="muted">
          Could not load the capabilities.
        </Text>
        <Button variant="ghost" size="sm" onPress={() => void capabilities.refetch()}>
          Retry
        </Button>
      </Stack>
    );
  }
  const selected = new Set(value);
  const toggleExpand = (module: string): void =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(module)) next.delete(module);
      else next.add(module);
      return next;
    });
  const toggleCapability = (id: string): void =>
    onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <Stack gap={3} testID="capability-picker">
      {capabilityGroups(capabilities.data).map((group) => (
        <ModuleSection
          key={group.module}
          group={group}
          selected={selected}
          expanded={expanded.has(group.module)}
          onToggleExpand={() => toggleExpand(group.module)}
          onToggleCapability={toggleCapability}
        />
      ))}
    </Stack>
  );
}

export interface CapabilityPickerProps {
  readonly value: readonly string[];
  readonly onChange: (ids: string[]) => void;
}

/**
 * A multi-select of the capability pick-list (`GET /admin/capabilities`), grouped by module and
 * collapsed by default — the 600+ grantable capabilities are unmanageable as one flat list, and each
 * module header shows how many of its capabilities the role holds. Selection is controlled by the
 * parent (the role editor's draft).
 *
 *   <CapabilityPicker value={draft.capabilityIds} onChange={(ids) => set({ capabilityIds: ids })} />
 */
export function CapabilityPicker({ value, onChange }: CapabilityPickerProps) {
  const capabilities = useCapabilities();
  return <PickerBody capabilities={capabilities} value={value} onChange={onChange} />;
}
