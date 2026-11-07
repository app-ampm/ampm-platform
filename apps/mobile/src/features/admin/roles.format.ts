import type { CapabilityView, RoleView } from "@ampm/core";
import type { StatusTone } from "@ampm/ui";

/*
 * Presentation helpers for the roles-and-permissions viewer (TW-91): how a role's kind reads, its
 * permission count in words, a module slug as a human heading, and a role's capabilities grouped by
 * module for the detail sheet. No fetching, no rules.
 */

/** "System" for a built-in role, "Custom" for one a Super Admin built. */
export function roleTypeLabel(isSystem: boolean): string {
  return isSystem ? "System" : "Custom";
}

/** Peacock for a built-in role, a subtle well for a custom one. */
export function roleTypeTone(isSystem: boolean): StatusTone {
  return isSystem ? "brand" : "neutral";
}

/** The permission count in words: "No permissions", "1 permission", "4 permissions". */
export function permissionCountLabel(count: number): string {
  if (count === 0) return "No permissions";
  return `${count} permission${count === 1 ? "" : "s"}`;
}

/** A module slug as a heading: "hotel_discovery" → "Hotel discovery". */
export function moduleLabel(module: string): string {
  const spaced = module.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** One module's capabilities, for the detail sheet. */
export interface CapabilityGroup {
  readonly module: string;
  readonly label: string;
  readonly capabilities: readonly CapabilityView[];
}

const byLabel = (a: { label: string }, b: { label: string }): number =>
  a.label < b.label ? -1 : a.label > b.label ? 1 : 0;

/** A role's capabilities grouped by module, modules and the rows within each sorted by label. */
export function capabilityGroups(capabilities: readonly CapabilityView[]): CapabilityGroup[] {
  const byModule = new Map<string, CapabilityView[]>();
  for (const capability of capabilities) {
    const list = byModule.get(capability.module) ?? [];
    list.push(capability);
    byModule.set(capability.module, list);
  }
  return [...byModule.entries()]
    .map(([module, items]) => ({
      module,
      label: moduleLabel(module),
      capabilities: [...items].sort(byLabel),
    }))
    .sort(byLabel);
}

/** A screen-reader summary of one role row: "Sales, system role, 4 permissions". */
export function roleSummary(role: RoleView): string {
  return `${role.name}, ${roleTypeLabel(role.isSystem).toLowerCase()} role, ${permissionCountLabel(
    role.capabilities.length,
  )}`;
}
