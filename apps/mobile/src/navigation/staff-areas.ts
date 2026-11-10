import type { MeResponse } from "@ampm/core";
import { permissionKeysForRole, type StaffRole } from "@ampm/policy";
import type { IconName } from "@ampm/ui";

import { isOnRoute } from "./routes";

export type StaffAreaKey = "leads" | "enquiries" | "tasks" | "hotels" | "admin" | "settings";

/** The routes of the staff workspace's areas: each is the area's top-level screen. */
export type StaffAreaPath =
  "/leads" | "/enquiries" | "/field-notes" | "/hotels-admin" | "/admin" | "/account";

export interface StaffArea {
  readonly key: StaffAreaKey;
  /** The rail's name for the area (the T artboards). */
  readonly label: string;
  /** The phone tab's short name (the M artboards). */
  readonly tabLabel: string;
  readonly icon: IconName;
  readonly href: StaffAreaPath;
  /** The read key a role must grant to see the area; `null` for an area every staff member has. */
  readonly permission: string | null;
}

/**
 * The admin workspace areas that exist today, in the rail's order (docs/design/peacock-night.md §7).
 * Hiding an area is a convenience: the server still refuses what a role may not read.
 */
export const STAFF_AREAS: readonly StaffArea[] = [
  {
    key: "leads",
    label: "Leads & Clients",
    tabLabel: "Leads",
    icon: "users",
    href: "/leads",
    permission: "crm.leads.read",
  },
  {
    key: "enquiries",
    label: "Hotel enquiries",
    tabLabel: "Enquiries",
    icon: "hotel",
    href: "/enquiries",
    permission: "consultancy.enquiries.read",
  },
  {
    key: "tasks",
    label: "Tasks & Operations",
    tabLabel: "Tasks",
    icon: "list-checks",
    href: "/field-notes",
    // The key the area's only screen needs today: the field-notes spike reads and writes as incidents.
    // The real task screens (M5) will ask for "tasks.tasks.read" instead.
    permission: "tasks.incidents.read",
  },
  {
    key: "hotels",
    label: "Hotel catalogue",
    tabLabel: "Hotels",
    icon: "landmark",
    href: "/hotels-admin",
    // The catalogue + photo manager is the Hotel team's and Super Admin's surface (SM may manage media
    // rights too). Hotel-profile reads reach every role for look-ups, so the area is gated on a
    // media-management key only those roles hold, as the admin console is on a staff-management key.
    permission: "hotels.hotel_media_rights_status.update",
  },
  {
    key: "admin",
    label: "Admin console",
    tabLabel: "Admin",
    icon: "shield-check",
    href: "/admin",
    // The console is the Super Admin's surface (TW-90 "Who: SA"; the Settings area only SA sees in
    // full). The directory read is open to every role for incidental look-ups, so the area is gated on
    // a staff-management key only SA holds; sections other roles may see (e.g. reference data for
    // Finance) will reveal themselves per-section once they are built.
    permission: "admin.staff_users.update",
  },
  {
    key: "settings",
    label: "Settings",
    tabLabel: "More",
    icon: "settings",
    href: "/account",
    permission: null,
  },
];

const keysByRole = new Map<StaffRole, readonly string[]>();

/** A role's unconditional keys from the matrix, read once per role. */
function keysOf(role: StaffRole): readonly string[] {
  const known = keysByRole.get(role);
  if (known) return known;
  const keys = permissionKeysForRole(role);
  keysByRole.set(role, keys);
  return keys;
}

/** A key grants the needed one as written or narrowed to a scope: "…read" or "…read:assigned". */
function keyGrants(key: string, needed: string): boolean {
  return key === needed || key.startsWith(`${needed}:`);
}

/** Whether any of the roles grants the permission (@ampm/policy, permission-matrix §5). */
export function rolesGrant(roles: readonly StaffRole[], permission: string): boolean {
  return roles.some((role) => keysOf(role).some((key) => keyGrants(key, permission)));
}

/** The areas a signed-in principal sees: a staff member's granted areas; nothing for anyone else. */
export function staffAreasFor(me: Pick<MeResponse, "principal" | "roles">): StaffArea[] {
  if (me.principal.type !== "staff") return [];
  return STAFF_AREAS.filter(
    (area) => area.permission === null || rolesGrant(me.roles, area.permission),
  );
}

/** The area whose screen is showing, from the path: "/leads/123" is in Leads. */
export function activeStaffArea(pathname: string): StaffArea | undefined {
  return STAFF_AREAS.find((area) => isOnRoute(pathname, area.href));
}

/** Whether the person's roles grant the area (`staffAreasFor`): the account screen's field-notes link. */
export function hasStaffArea(
  me: Pick<MeResponse, "principal" | "roles">,
  key: StaffAreaKey,
): boolean {
  return staffAreasFor(me).some((area) => area.key === key);
}

/**
 * Where a staff member lands after sign-in: their first area, or Settings (the account screen, every
 * staff member's) for one whose roles grant none of the others.
 */
export function staffHomeHref(me: Pick<MeResponse, "principal" | "roles">): StaffAreaPath {
  return staffAreasFor(me)[0]?.href ?? "/account";
}
