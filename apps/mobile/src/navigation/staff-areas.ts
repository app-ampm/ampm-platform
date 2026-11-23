import { staffAccessFor, type StaffAccessSource } from "@ampm/api-client";
import type { IconName } from "@ampm/ui";

import { isOnRoute } from "./routes";

export type StaffAreaKey =
  "leads" | "enquiries" | "tasks" | "hotels" | "finance" | "admin" | "settings";

/** The routes of the staff workspace's areas: each is the area's top-level screen. */
export type StaffAreaPath =
  "/leads" | "/enquiries" | "/field-notes" | "/hotels-admin" | "/finance" | "/admin" | "/account";

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
    key: "finance",
    label: "Finance & Reports",
    tabLabel: "Finance",
    icon: "receipt",
    href: "/finance",
    // The area's screen is the subscription status report (permission-matrix §5.16: SA, SM, FA), the
    // read Finance has, where its field-conditioned CRM grants refuse every list (D-127, D-128).
    permission: "reports.subscription_status_payment_history.read",
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

/**
 * The areas a signed-in principal sees: a staff member's granted areas; nothing for anyone else. An area
 * shows when the person holds its key in any scope (`holds`), from a system role or a custom role's
 * capabilities (D-164): a project manager sees the enquiries of their own weddings.
 */
export function staffAreasFor(me: StaffAccessSource): StaffArea[] {
  if (me.principal.type !== "staff") return [];
  const access = staffAccessFor(me);
  return STAFF_AREAS.filter((area) => area.permission === null || access.holds(area.permission));
}

/** The area whose screen is showing, from the path: "/leads/123" is in Leads. */
export function activeStaffArea(pathname: string): StaffArea | undefined {
  return STAFF_AREAS.find((area) => isOnRoute(pathname, area.href));
}

/** Whether the person's roles grant the area (`staffAreasFor`): the account screen's field-notes link. */
export function hasStaffArea(me: StaffAccessSource, key: StaffAreaKey): boolean {
  return staffAreasFor(me).some((area) => area.key === key);
}

/**
 * The order in which a staff member's areas are tried for their home: the rail's, except that Finance
 * & Reports comes before the hotel enquiries Finance may also read, so Finance lands on its own work
 * (D-128). No other role holds both without also holding Leads & Clients, which comes first.
 */
const HOME_ORDER: readonly StaffAreaKey[] = [
  "leads",
  "finance",
  "enquiries",
  "tasks",
  "hotels",
  "admin",
  "settings",
];

/**
 * Where a staff member lands after sign-in: the first of their areas in `HOME_ORDER`, or Settings (the
 * account screen, every staff member's) for one whose roles grant none of the others.
 */
export function staffHomeHref(me: StaffAccessSource): StaffAreaPath {
  const areas = staffAreasFor(me);
  const home = HOME_ORDER.map((key) => areas.find((area) => area.key === key)).find(Boolean);
  return home?.href ?? "/account";
}
