import { MATRIX } from "./matrix";
import type { RowName } from "./record-rows";

/**
 * §10's resource names (permission-matrix.md lines 538-553) that are not the generated resource of
 * their row, by `module.resource`, with the §5 row each names in its own module. A key spelt this
 * way decides on that row, so a route written with the documented key reaches the same grants as
 * the generated spelling. A §10 key that names its row from another module is in OUTSIDE_KEYS
 * (resources.ts). document-keys.test.ts walks the §10 table and fails on a spelling left out.
 *
 * @example
 * DOCUMENT_RESOURCES["functions.readiness"]?.section; // "5.6"
 */
export const DOCUMENT_RESOURCES: Readonly<Record<string, RowName>> = {
  // Lines 538-540: the hotel profile, rate card and contact rows of §5.3 (lines 169, 173, 171).
  "hotels.profiles": { section: "5.3", label: "Hotel profiles, client fields" },
  "hotels.rate_cards": { section: "5.3", label: "Rate cards and rate items" },
  "hotels.contacts": { section: "5.3", label: "Hotel contacts" },
  // consultancy.proposals needs no bridge: feature 10.4 curated the §5.4 "Hotel proposals, client
  // amounts" row's resource to `proposals`, so `consultancy.proposals.*` resolves directly (the internal
  // total is reached through that row's `read_internal_amount` alias).
  // Line 543: adding or removing members on a project is the §5.5 staff members row (line 197).
  "projects.members": { section: "5.5", label: "Project members, staff" },
  // Lines 544-545: budget lines are the §5.7 row of line 216; `read_internal_cost` reads line 217.
  "budget.lines": { section: "5.7", label: "Budget lines, client-facing amounts" },
  // Line 550: allergies and accessibility needs are the §5.10 sensitive fields (line 263).
  "guests.sensitive": {
    section: "5.10",
    label: "Guest sensitive fields (allergies, accessibility)",
  },
  // Line 551: authorising a readiness exception is the §5.6 decision of line 208.
  "functions.readiness": {
    section: "5.6",
    label: "Readiness exceptions (Q10: Eva's authorised personnel only)",
  },
};

/**
 * The generated resource a §10 resource name stands for in its module (DOCUMENT_RESOURCES), or
 * the name itself when §10 does not spell it differently.
 *
 * @example
 * documentResource("functions", "readiness"); // "readiness_exceptions"
 * documentResource("tasks", "incidents"); // "incidents"
 */
export function documentResource(module: string, resource: string): string {
  const name = `${module}.${resource}`;
  const row = Object.hasOwn(DOCUMENT_RESOURCES, name) ? DOCUMENT_RESOURCES[name] : undefined;
  if (!row) return resource;
  const found = MATRIX.staff.find(
    (r) => r.module === module && r.section === row.section && r.label === row.label,
  );
  return found?.resource ?? resource;
}
