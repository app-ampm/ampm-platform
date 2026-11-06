/*
 * The records the §4 golden table (src/golden/classes.ts, src/golden/classes-notes.ts) tries the
 * classes on: the rows they are read through, as resources.ts names them, with the §5 line of
 * docs/permission-matrix.md in the comment.
 */
import type { VisibilityClass } from "../classes";
import type { StaffRole } from "../roles";
import type { ClassContext } from "../visibility";

/**
 * One §4 class: the contexts it is tried in, by name, and per role the names of those that open
 * it; a role it does not list opens it in none.
 *
 * @example
 * const golden: ClassGolden = { cls: "SECRET", line: 128, contexts: { anywhere: {} }, opens: {} };
 */
export interface ClassGolden {
  readonly cls: VisibilityClass;
  /** The class's row in §4. */
  readonly line: number;
  readonly contexts: Readonly<Record<string, ClassContext>>;
  readonly opens: Readonly<Partial<Record<StaffRole, readonly string[]>>>;
}

/**
 * A context read through one row of §5, with the facts the row's cell needs.
 *
 * @example
 * on(ROWS.functions, { assigned: true, fields: ["theme"] }); // CD's §5.6 cell, line 203
 */
export const on = (resource: string, facts: ClassContext = {}): ClassContext => ({
  ...facts,
  resource,
});

/**
 * A record of a project the principal is assigned to.
 *
 * @example
 * on(ROWS.guests, A);
 */
export const A: ClassContext = { assigned: true };

/**
 * Every fact a conditioned grant can ask for at once.
 *
 * @example
 * staffReadableClasses(["SA"], EVERY_FACT).has("RESTRICTED-IDENTITY"); // true, break-glass
 */
export const EVERY_FACT: ClassContext = {
  assigned: true,
  owned: true,
  explicitGrant: true,
  checks: ["check_in", "break_glass"],
};

/**
 * The §5 rows the golden contexts are read through (`module.resource`), line in the comment.
 *
 * @example
 * on(ROWS.functions, A);
 */
export const ROWS = {
  hotelProfiles: "hotels.hotel_profiles_client_fields", // 168
  hotelContacts: "hotels.hotel_contacts", // 170
  enquiries: "consultancy.enquiries", // 182
  projects: "projects.wedding_projects", // 193
  projectNotes: "projects.project_internal_notes", // 194
  venues: "projects.project_hotels_external_venues", // 195
  functions: "functions.functions", // 203
  runOfShow: "functions.run_show_items", // 205
  clientLines: "budget.budget_lines_client_facing", // 215
  internalCost: "budget.budget_lines_internal_cost", // 216
  vendorProfiles: "vendors.vendor_profiles_client_fields", // 230
  vendorContacts: "vendors.vendor_contacts", // 231
  bankDetails: "vendors.vendor_bank_details", // 233, VC's cell as notes.ts reads it
  internalComments: "creative.comments_internal", // 248
  guests: "guests.family_groups_guests_standard", // 261
  sensitive: "guests.guest_sensitive_fields", // 262
  identity: "guests.identity_documents", // 264
  support: "guests.guest_support_requests", // 268
  vehicles: "rooms.vehicles_transfers_passengers", // 278
  incidents: "tasks.incidents", // 296
  accounts: "crm.accounts", // §5.2 line 155
} as const;
