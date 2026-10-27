import { MATRIX } from "./matrix";
import type { RowName } from "./record-rows";

/**
 * §10's resource names (permission-matrix.md lines 535-551) that are not the generated resource of
 * their row, by `module.resource`, with the §5 row each names in its own module. A key spelt this
 * way decides on that row, so a route written with the documented key reaches the same grants as
 * the generated spelling. A §10 key that names its row from another module is in OUTSIDE_KEYS
 * (resources.ts).
 *
 * @example
 * DOCUMENT_RESOURCES["functions.readiness"]?.section; // "5.6"
 */
export const DOCUMENT_RESOURCES: Readonly<Record<string, RowName>> = {
  // Line 549: authorising a readiness exception is the §5.6 decision of line 207.
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
