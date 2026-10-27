import { MATRIX, type MatrixRow } from "./matrix";

/**
 * A §5 row by its section and its label as the document prints it.
 *
 * @example
 * const items: RowName = { section: "5.6", label: "Readiness checklist items" };
 */
export interface RowName {
  readonly section: string;
  readonly label: string;
}

/**
 * A §5 row that no role reads, because it is an action (a decision, a status, a share) on a record
 * another row holds, with that row.
 *
 * @example
 * const close: RecordRow = {
 *   row: { section: "5.15", label: "Close the project" },
 *   record: { section: "5.5", label: "Wedding projects (create, edit, status)" },
 * };
 */
export interface RecordRow {
  readonly row: RowName;
  /** The row of the record the decision acts on; null when it acts on no one row's record. */
  readonly record: RowName | null;
}

const WEDDING_PROJECTS: RowName = {
  section: "5.5",
  label: "Wedding projects (create, edit, status)",
};

/**
 * The record each §5 row that no role reads acts on, from the document by hand: whether the
 * principal may see that record decides a refusal's 403 or 404 (test-cases.md line 212).
 * record-rows.test.ts fails when the matrix gains such a row that is not listed here.
 *
 * @example
 * RECORD_ROWS.find((entry) => entry.row.label === "Close the project")?.record?.section; // "5.5"
 */
export const RECORD_ROWS: readonly RecordRow[] = [
  // §5.6 line 207 authorises an exception on a readiness checklist item (line 206), which turns
  // `exception` with `exception_authorised_by` (data-model.md line 1822; AC-13.2, line 925).
  {
    row: { section: "5.6", label: "Readiness exceptions (Q10: Eva's authorised personnel only)" },
    record: { section: "5.6", label: "Readiness checklist items" },
  },
  // §5.6 line 208 sets a function's `status` (line 203; data-model.md line 814).
  {
    row: { section: "5.6", label: "Function status (planned, confirmed, cancelled)" },
    record: { section: "5.6", label: "Functions" },
  },
  // §5.9 line 252 records the client's decision on an approval (line 251), as an
  // `approval_decisions` row with `recorded_on_behalf_by` (data-model.md line 1245).
  {
    row: { section: "5.9", label: "Approval decisions, on the client's behalf with evidence" },
    record: { section: "5.9", label: "Approvals, submit for decision" },
  },
  // §5.14 line 303 sets a document's `visibility` (line 302; data-model.md line 1728).
  {
    row: { section: "5.14", label: "Set client visibility on a document" },
    record: { section: "5.14", label: "Documents on records the role can reach" },
  },
  // §5.15 lines 312 and 313 close and archive the wedding of §5.5 line 193 (`closed_at` and
  // `archived_at`, data-model.md lines 745 and 746).
  { row: { section: "5.15", label: "Close the project" }, record: WEDDING_PROJECTS },
  {
    row: { section: "5.15", label: "Archive the project after the window (Q23)" },
    record: WEDDING_PROJECTS,
  },
  // §5.15 line 314 approves a deletion the retention job proposed (§8 line 507): identity
  // documents, guest data or leads, so no one row's record.
  {
    row: {
      section: "5.15",
      label: "Approve a retention deletion proposed by the retention job (Q17)",
    },
    record: null,
  },
];

/**
 * Class rows whose records are a table of their own (data-model.md §19, "whole table"): a key on
 * them acts on those records, not on the parent row their §10 key names, so a principal who may
 * not read them gets the 404 of a missing record (AC-10.9, test-cases.md line 801).
 *
 * @example
 * OWN_TABLE_ROWS.some((name) => name.label === "Identity documents"); // true
 */
export const OWN_TABLE_ROWS: readonly RowName[] = [
  // data-model.md line 1949: `hotel_contacts`.
  { section: "5.3", label: "Hotel contacts" },
  // data-model.md line 2002: `identity_documents`.
  { section: "5.10", label: "Identity documents" },
];

function isNamed(row: MatrixRow, name: RowName): boolean {
  return row.section === name.section && row.label === name.label;
}

function isRead(row: MatrixRow): boolean {
  return Object.values(row.grants).some((grants) => grants.some((g) => g.actions.includes("read")));
}

/** The parent row a class row's §10 key names (resources.ts KEY_ALIASES), as tableRow() reads it. */
function parentRow(row: MatrixRow): MatrixRow | undefined {
  const parent = row.aliases.find((alias) => alias.resource !== row.resource);
  if (!parent) return undefined;
  return MATRIX.staff.find((r) => r.module === row.module && r.resource === parent.resource);
}

/**
 * The row of the record a key on `row` acts on: a decision's record row (RECORD_ROWS); the row
 * itself for a class kept in a table of its own; the parent row for a class of a record's columns
 * ("Budget lines, internal cost"); otherwise the row itself. Null when no role reads the record.
 *
 * @example
 * const close = MATRIX.staff.find((row) => row.label === "Close the project");
 * close && recordRowOf(close)?.resource; // "wedding_projects"
 */
export function recordRowOf(row: MatrixRow): MatrixRow | null {
  const decision = RECORD_ROWS.find((entry) => isNamed(row, entry.row));
  if (decision) {
    const record = decision.record;
    return record === null ? null : (MATRIX.staff.find((r) => isNamed(r, record)) ?? null);
  }
  if (OWN_TABLE_ROWS.some((name) => isNamed(row, name))) return row;
  const parent = parentRow(row);
  if (parent) return parent;
  return isRead(row) ? row : null;
}
