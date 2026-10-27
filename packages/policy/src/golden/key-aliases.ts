/*
 * Golden cases for the §10 alias keys (resources.ts KEY_ALIASES), written by hand from
 * docs/permission-matrix.md: each literal key, the §5 row it stands for, and who holds it by that
 * row's cell, with the scope and the facts a conditioned cell needs (src/keys.golden.test.ts).
 */
import type { ConditionFacts } from "../conditions";
import type { Scope, StaffRole } from "../roles";

/**
 * One holder of an alias key: the scope of its cell and the facts its note needs.
 *
 * @example
 * const hotelLines: AliasHolder = { scope: "all", facts: { side: "hotel" } };
 */
export interface AliasHolder {
  readonly scope: Scope;
  readonly facts?: ConditionFacts;
  /** "with explicit grant": the user holds an explicit grant of the key on the wedding (P-5). */
  readonly explicit?: boolean;
}

/**
 * A §10 alias key and the row it decides on; a role it does not list holds no grant.
 *
 * @example
 * const golden: AliasGolden = { line: 194, section: "5.5", label: "Project internal notes", key, holders };
 */
export interface AliasGolden {
  /** The §5 line of the row the key stands for, and its subsection and label (KEY_ALIASES). */
  readonly line: number;
  readonly section: string;
  readonly label: string;
  readonly key: string;
  readonly holders: Readonly<Partial<Record<StaffRole, AliasHolder>>>;
}

const ALL: AliasHolder = { scope: "all" };
const ASSIGNED: AliasHolder = { scope: "assigned" };

/**
 * Every KEY_ALIASES entry, in the document's order.
 *
 * @example
 * KEY_ALIAS_GOLDEN.find((golden) => golden.line === 216)?.key;
 * // → "budget.budget_lines_client_facing.read_internal_cost"
 */
export const KEY_ALIAS_GOLDEN: readonly AliasGolden[] = [
  {
    line: 169,
    section: "5.3",
    label: "Hotel internal rating and notes",
    key: "hotels.hotel_profiles_client_fields.read_internal_notes",
    holders: { SA: ALL, SM: ALL, HT: ALL, PM: ALL },
  },
  {
    line: 170,
    section: "5.3",
    label: "Hotel contacts",
    key: "hotels.hotel_profiles_client_fields.read_contacts",
    holders: { SA: ALL, SM: ALL, HT: ALL, PM: ALL, HL: ASSIGNED },
  },
  {
    line: 183,
    section: "5.4",
    label: "Enquiry internal notes and internal-only events",
    key: "consultancy.hotel_enquiries_client_fields.read_internal_notes",
    holders: { SA: ALL, SM: ALL, HT: ALL, PM: ASSIGNED },
  },
  {
    line: 186,
    section: "5.4",
    label: "Hotel proposals, internal amounts",
    key: "consultancy.hotel_proposals_client_amounts.read_internal_amount",
    holders: { SA: ALL, HT: ALL, PM: ASSIGNED, FA: ALL },
  },
  {
    line: 194,
    section: "5.5",
    label: "Project internal notes",
    key: "projects.wedding_projects.read_internal_notes",
    holders: { SA: ALL, PM: ASSIGNED, FA: ALL },
  },
  {
    // "A" for SA; PM "request only" holds nothing (Q10).
    line: 207,
    section: "5.6",
    label: "Readiness exceptions (Q10: Eva's authorised personnel only)",
    key: "functions.readiness_exceptions.authorise_exception",
    holders: { SA: ALL },
  },
  {
    line: 216,
    section: "5.7",
    label: "Budget lines, internal cost",
    key: "budget.budget_lines_client_facing.read_internal_cost",
    holders: {
      SA: ALL,
      HT: { scope: "all", facts: { side: "hotel" } },
      PM: ASSIGNED,
      VC: { scope: "assigned", facts: { side: "vendor" } },
      FA: ALL,
    },
  },
  {
    line: 231,
    section: "5.8",
    label: "Vendor contacts",
    key: "vendors.vendor_profiles_client_fields.read_contacts",
    holders: { SA: ALL, PM: ASSIGNED, VC: ALL, HL: ASSIGNED },
  },
  {
    line: 232,
    section: "5.8",
    label: "Vendor internal rating and notes",
    key: "vendors.vendor_profiles_client_fields.read_internal_notes",
    holders: { SA: ALL, PM: ASSIGNED, VC: ALL },
  },
  {
    line: 237,
    section: "5.8",
    label: "Vendor proposals, internal cost",
    key: "vendors.vendor_proposals_client_amounts.read_internal_cost",
    holders: { SA: ALL, PM: ASSIGNED, VC: ALL, FA: ALL },
  },
  {
    line: 240,
    section: "5.8",
    label: "Artist fee, internal",
    key: "vendors.artist_bookings.read_internal_cost",
    holders: { SA: ALL, PM: ASSIGNED, VC: ALL, FA: ALL },
  },
  {
    line: 252,
    section: "5.9",
    label: "Approval decisions, on the client's behalf with evidence",
    key: "creative.approval_decisions_on_client.create_on_behalf",
    holders: { SA: ALL, PM: ASSIGNED },
  },
  {
    line: 262,
    section: "5.10",
    label: "Guest sensitive fields (allergies, accessibility)",
    key: "guests.family_groups_guests_standard.read_sensitive",
    holders: { SA: ALL, PM: ASSIGNED, RG: ASSIGNED, HL: ASSIGNED },
  },
  {
    line: 263,
    section: "5.10",
    label: "Guest internal notes",
    key: "guests.family_groups_guests_standard.read_internal_notes",
    holders: { SA: ALL, PM: ASSIGNED, RG: ASSIGNED, HL: ASSIGNED },
  },
  {
    line: 264,
    section: "5.10",
    label: "Identity documents",
    key: "guests.family_groups_guests_standard.read_identity",
    holders: {
      SA: { scope: "all", facts: { checks: ["break_glass"] } },
      RG: { scope: "assigned", explicit: true },
      HL: { scope: "assigned", facts: { checks: ["check_in"] } },
    },
  },
  {
    line: 275,
    section: "5.11",
    label: "Room blocks, internal rate",
    key: "rooms.room_blocks_client_fields.read_internal_cost",
    holders: { SA: ALL, HT: ALL, PM: ASSIGNED, FA: ALL },
  },
];
