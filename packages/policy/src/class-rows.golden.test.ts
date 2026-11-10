/**
 * The key layer and the class layer of §1 against each other on the §5 rows whose records hold one
 * visibility class. A role decide() lets read such a row must be a role staffReadableClasses() can
 * open that class to; otherwise it reads, and may write, records whose columns it is never shown
 * (ENGINE-4: VC on vendor bank details, §4 line 125 against §5.8 line 234). The rows, their classes
 * and the sides of their records are written by hand from §4 lines 122-127 and the §5 labels; the
 * readers come from the generated matrix, since this compares what the two layers do with it.
 */
import { describe, expect, it } from "vitest";

import { documentTableRows } from "./authz/document";
import { FOREIGN_PROJECT, ME, MEMBER_PROJECT, SOMEONE, factsFor, member } from "./authz/fixtures";
import type { VisibilityClass } from "./classes";
import type { Side } from "./conditions";
import { decide, type PolicyTarget } from "./engine";
import { MATRIX, type MatrixRow } from "./matrix";
import { STAFF_ROLE_CODES, type Scope, type StaffRole } from "./roles";
import { staffReadableClasses, type ClassContext } from "./visibility";

interface ClassRow {
  readonly line: number;
  readonly section: string;
  readonly label: string;
  readonly cls: VisibilityClass;
  /** The sides the row's records may have (§4 "hotel-side values", "vendor-side values"). */
  readonly sides: readonly (Side | undefined)[];
}

const UNSIDED = [undefined];
const HOTEL: readonly Side[] = ["hotel"];
const VENDOR: readonly Side[] = ["vendor"];
const EITHER: readonly Side[] = ["hotel", "vendor"];

function classRow(
  line: number,
  section: string,
  label: string,
  cls: VisibilityClass,
  sides: ClassRow["sides"] = UNSIDED,
): ClassRow {
  return { line, section, label, cls, sides };
}

const CLASS_ROWS: readonly ClassRow[] = [
  // §4 line 122: internal notes and ratings, internal-only enquiry events, internal comments and
  // incidents by default.
  classRow(170, "5.3", "Hotel internal rating and notes", "RESTRICTED-NOTES"),
  classRow(184, "5.4", "Enquiry internal notes and internal-only events", "RESTRICTED-NOTES"),
  classRow(195, "5.5", "Project internal notes", "RESTRICTED-NOTES"),
  classRow(233, "5.8", "Vendor internal rating and notes", "RESTRICTED-NOTES"),
  classRow(249, "5.9", "Comments, internal", "RESTRICTED-NOTES"),
  classRow(264, "5.10", "Guest internal notes", "RESTRICTED-NOTES"),
  classRow(297, "5.13", "Incidents (report, assign, escalate, resolve, close)", "RESTRICTED-NOTES"),
  // §4 line 123: internal amounts, and the whole tables of quotes, cost entries, contracts with a
  // vendor or hotel, invoices received and outbound payments.
  classRow(161, "5.2", "Payments outbound to vendors and hotels", "RESTRICTED-FINANCE", EITHER),
  classRow(187, "5.4", "Hotel proposals, internal amounts", "RESTRICTED-FINANCE", HOTEL),
  classRow(217, "5.7", "Budget lines, internal cost", "RESTRICTED-FINANCE", EITHER),
  classRow(218, "5.7", "Cost entries", "RESTRICTED-FINANCE", EITHER),
  classRow(219, "5.7", "Vendor quotes", "RESTRICTED-FINANCE", VENDOR),
  classRow(221, "5.7", "Contracts with vendors and hotels", "RESTRICTED-FINANCE", EITHER),
  classRow(223, "5.7", "Invoices received from vendors and hotels", "RESTRICTED-FINANCE", EITHER),
  classRow(238, "5.8", "Vendor proposals, internal cost", "RESTRICTED-FINANCE", VENDOR),
  classRow(241, "5.8", "Artist fee, internal", "RESTRICTED-FINANCE", VENDOR),
  classRow(276, "5.11", "Room blocks, internal rate", "RESTRICTED-FINANCE", HOTEL),
  // §4 line 124: hotel contacts (whole table) and the vendors' contact fields.
  classRow(171, "5.3", "Hotel contacts", "RESTRICTED-CONTACT", HOTEL),
  classRow(232, "5.8", "Vendor contacts", "RESTRICTED-CONTACT", VENDOR),
  // §4 lines 125-127.
  classRow(234, "5.8", "Vendor bank details", "RESTRICTED-BANK", VENDOR),
  classRow(263, "5.10", "Guest sensitive fields (allergies, accessibility)", "SENSITIVE-GUEST"),
  classRow(265, "5.10", "Identity documents", "RESTRICTED-IDENTITY"),
];

/** Rows whose label names a class but whose records hold several classes, and why. */
const MIXED_ROWS: Readonly<Record<string, string>> = {
  // §4 line 125 classes only the billing fields beyond the name; the contacts are no §4 class.
  "Client accounts and contacts": "accounts with RESTRICTED-BANK billing columns",
};

const IN_SCOPE: Readonly<Record<Scope, PolicyTarget>> = {
  all: {},
  assigned: { projectId: MEMBER_PROJECT, ownerId: SOMEONE },
  own: { projectId: FOREIGN_PROJECT, ownerId: ME },
};

interface Reading {
  readonly explicit: boolean;
  readonly target: PolicyTarget;
  readonly context: ClassContext;
}

/** Each record a read grant of the role reaches, once per side it may have, in both layers' terms. */
function readingsOf(row: MatrixRow, role: StaffRole, sides: ClassRow["sides"]): Reading[] {
  const reads = (row.grants[role] ?? []).filter((grant) => grant.actions.includes("read"));
  return reads.flatMap((grant) => {
    const { facts, explicitGrant } = factsFor(grant.conditions);
    const choices = facts.side === undefined ? sides : [facts.side];
    return choices.map((side) => ({
      explicit: explicitGrant,
      target: { ...IN_SCOPE[grant.scope], ...facts, side },
      context: {
        ...facts,
        side,
        assigned: grant.scope === "assigned",
        owned: grant.scope === "own",
        explicitGrant,
        resource: `${row.module}.${row.resource}`,
      },
    }));
  });
}

function matrixRow(golden: ClassRow): MatrixRow {
  const found = MATRIX.staff.find(
    (row) => row.section === golden.section && row.label === golden.label,
  );
  if (!found) throw new Error(`no §${golden.section} row "${golden.label}" in the matrix`);
  return found;
}

function expectAgreement(golden: ClassRow, role: StaffRole): void {
  const row = matrixRow(golden);
  const key = `${row.module}.${row.resource}.read`;
  const readings = readingsOf(row, role, golden.sides);
  for (const { explicit, target } of readings) {
    expect(decide(member(role, explicit ? key : undefined), key, target).allowed, key).toBe(true);
  }
  if (readings.length === 0) return;
  const shown = readings.some(({ context }) =>
    staffReadableClasses([role], context).has(golden.cls),
  );
  expect(shown, `${role} reads ${golden.label} but is never shown ${golden.cls}`).toBe(true);
}

describe("§1 layers 4 and 6: who reads a class row is shown its class", () => {
  const document = documentTableRows("## 5. Permission matrix: staff roles", "### 5.16");

  it("§4 lines 122-127: each class row is on the line and in the subsection the document gives it", () => {
    for (const golden of CLASS_ROWS) {
      const found = document.find((row) => row.line === golden.line);
      expect([found?.heading.split(" ")[0], found?.cells[0]], `line ${golden.line}`).toEqual([
        golden.section,
        golden.label,
      ]);
    }
  });

  it("§5 legend line 136: every row whose label names a class is a class row, or mixed with a reason", () => {
    const named = document
      .map((row) => row.cells[0] ?? "")
      .filter((label) => /internal|contact|bank|sensitive|identity/i.test(label));
    const known = [...CLASS_ROWS.map((golden) => golden.label), ...Object.keys(MIXED_ROWS)];
    expect(named.filter((label) => !known.includes(label))).toEqual([]);
  });

  for (const golden of CLASS_ROWS) {
    it(`§${golden.section} line ${golden.line}, §4: whoever reads ${golden.label} is shown ${golden.cls}`, () => {
      for (const role of STAFF_ROLE_CODES) expectAgreement(golden, role);
    });
  }
});
