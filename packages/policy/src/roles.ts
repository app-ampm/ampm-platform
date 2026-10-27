/** Roles and principals of permission-matrix §2; the role keys are the `roles.role_key` values of module A. */
export const STAFF_ROLES = {
  SA: { key: "super_admin", name: "Super Admin", assigned: false },
  SM: { key: "sales", name: "Sales / Relationship Manager", assigned: false },
  HT: { key: "hotel_team", name: "Hotel / Destination Team", assigned: false },
  PM: { key: "project_manager", name: "Wedding Project Manager", assigned: true },
  CD: { key: "creative", name: "Creative / Design Team", assigned: true },
  VC: { key: "vendor_coordinator", name: "Vendor Coordinator", assigned: false },
  RG: { key: "rsvp_team", name: "RSVP / Guest Team", assigned: true },
  HL: { key: "hospitality", name: "Hospitality / Logistics Team", assigned: true },
  FA: { key: "finance", name: "Finance / Accounts", assigned: false },
} as const;

export type StaffRole = keyof typeof STAFF_ROLES;
export type StaffRoleKey = (typeof STAFF_ROLES)[StaffRole]["key"];

function isStaffRole(code: string): code is StaffRole {
  return Object.hasOwn(STAFF_ROLES, code);
}

/**
 * The nine role codes in the order of §2.
 *
 * @example
 * for (const code of STAFF_ROLE_CODES) seedRole(code, STAFF_ROLES[code]);
 */
export const STAFF_ROLE_CODES: StaffRole[] = Object.keys(STAFF_ROLES).filter(isStaffRole);

export function roleFromKey(key: string): StaffRole | undefined {
  return STAFF_ROLE_CODES.find((code) => STAFF_ROLES[code].key === key);
}

/** Non-staff principals: the client representative, a guest token, a demo prospect, the system. */
export const OTHER_PRINCIPALS = { CR: "client", GU: "guest", DP: "demo", SYS: "system" } as const;
export type PrincipalType = "staff" | "client" | "demo" | "guest" | "system";

export type Action = "create" | "read" | "update" | "delete" | "approve" | "share" | "export";
export const ACTION_LETTERS: Record<string, Action> = {
  C: "create",
  R: "read",
  U: "update",
  D: "delete",
  A: "approve",
  S: "share",
  X: "export",
};

/** `all` reaches every record, `assigned` only member projects, `own` only records the user owns. */
export type Scope = "all" | "assigned" | "own";
