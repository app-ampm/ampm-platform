import { readFileSync } from "node:fs";

import type { Transition } from "../matrix";

/*
 * The test suites' own reading of docs/permission-matrix.md, from the text alone and apart from
 * the generator: which table rows each section holds, on which line, with which cells. A row the
 * generator skips (an indented one, say), or a golden table that misses a row, then disagrees.
 */
const LINES = readFileSync(
  new URL("../../../../docs/permission-matrix.md", import.meta.url),
  "utf8",
).split("\n");

/**
 * A data row of a table: its line number in the document (from 1), the "###" heading it sits
 * under, and its cells.
 *
 * @example
 * const { line, cells } = documentTableRows("## 6.", "## 7.")[0]; // 342, ["Hotel discovery …", "R", …]
 */
export interface DocumentRow {
  readonly line: number;
  readonly heading: string;
  readonly cells: readonly string[];
}

function lineOf(heading: string, after: number): number {
  const index = LINES.findIndex((line, at) => at > after && line.startsWith(heading));
  if (index < 0) throw new Error(`permission-matrix.md: no heading "${heading}"`);
  return index;
}

function isSeparator(line: string): boolean {
  return /^\|[\s|:-]+\|$/.test(line.trim());
}

/**
 * The data rows of the tables between two headings: every line that starts with "|", indented or
 * not, less each table's header (the line above its separator) and the separator itself.
 *
 * @example
 * documentTableRows("### 5.8", "### 5.9").map((row) => row.cells[0]); // ["Vendor categories", …]
 */
export function documentTableRows(from: string, to: string): DocumentRow[] {
  const start = lineOf(from, -1);
  const end = lineOf(to, start);
  const rows: DocumentRow[] = [];
  let heading = "";
  for (let at = start; at < end; at += 1) {
    const line = (LINES[at] ?? "").trim();
    heading = /^### (.+)$/.exec(line)?.[1]?.trim() ?? heading;
    if (!line.startsWith("|") || isSeparator(line) || isSeparator(LINES[at + 1] ?? "")) continue;
    const cells = line
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((cell) => cell.trim());
    rows.push({ line: at + 1, heading, cells });
  }
  return rows;
}

/**
 * How many data rows the tables between two headings hold.
 *
 * @example
 * expect(MATRIX.others).toHaveLength(documentRows("## 6. Permission matrix", "## 7. Status"));
 */
export function documentRows(from: string, to: string): number {
  return documentTableRows(from, to).length;
}

/**
 * The §7 rows the rules came from: the clauses of one row share its entity, cells and Who text.
 *
 * @example
 * expect(transitionRows(MATRIX.transitions)).toBe(documentRows("## 7.", "## 8."));
 */
export function transitionRows(rules: readonly Transition[]): number {
  const rows = new Set(
    rules.map((rule) =>
      JSON.stringify([rule.entity, rule.from, rule.to, rule.restore, rule.kind, rule.who]),
    ),
  );
  return rows.size;
}
