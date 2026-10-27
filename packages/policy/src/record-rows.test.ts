/**
 * The hand-written record rows (record-rows.ts) against the generated matrix: every row no role
 * reads is curated, and every row an entry names is one the matrix has.
 */
import { describe, expect, it } from "vitest";

import { MATRIX, type MatrixRow } from "./matrix";
import { OWN_TABLE_ROWS, RECORD_ROWS, type RowName } from "./record-rows";

const nameOf = (row: MatrixRow): string => `${row.section} ${row.label}`;
const named = (row: RowName): string => `${row.section} ${row.label}`;
const isRead = (row: MatrixRow): boolean =>
  Object.values(row.grants).some((grants) => grants.some((g) => g.actions.includes("read")));

function rowNamed(name: RowName): MatrixRow | undefined {
  return MATRIX.staff.find((row) => row.section === name.section && row.label === name.label);
}

describe("RECORD_ROWS", () => {
  it("curates every §5 row that no role reads, so a new decision row cannot pass unmapped", () => {
    const unread = MATRIX.staff.filter((row) => !isRead(row)).map(nameOf);
    expect(RECORD_ROWS.map((entry) => named(entry.row)).sort()).toEqual(unread.sort());
  });

  it("maps each to a row the matrix has and some role reads", () => {
    for (const entry of RECORD_ROWS) {
      if (entry.record === null) continue;
      const record = rowNamed(entry.record);
      expect(record, named(entry.record)).toBeDefined();
      expect(record !== undefined && isRead(record), named(entry.record)).toBe(true);
    }
  });
});

describe("OWN_TABLE_ROWS", () => {
  it("names class rows the matrix has, each with the parent row its §10 key names", () => {
    for (const name of OWN_TABLE_ROWS) {
      const row = rowNamed(name);
      expect(row, named(name)).toBeDefined();
      expect(row?.aliases.some((alias) => alias.resource !== row.resource)).toBe(true);
    }
  });
});
