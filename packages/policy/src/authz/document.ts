import { readFileSync } from "node:fs";

import type { Transition } from "../matrix";

/*
 * The generated suites' own reading of docs/permission-matrix.md: how many table rows each section
 * holds, counted from the text alone, so a row the generator skips (an indented one, say) makes
 * the counts disagree instead of passing silently.
 */
const DOCUMENT = readFileSync(
  new URL("../../../../docs/permission-matrix.md", import.meta.url),
  "utf8",
);

/**
 * The data rows of the tables between two headings: every line that starts with "|", indented or
 * not, less each table's header and separator line.
 *
 * @example
 * expect(MATRIX.others).toHaveLength(documentRows("## 6. Permission matrix", "## 7. Status"));
 */
export function documentRows(from: string, to: string): number {
  const start = DOCUMENT.indexOf(from);
  const end = DOCUMENT.indexOf(to, start + 1);
  if (start < 0 || end < 0) throw new Error(`permission-matrix.md: no section "${from}"`);
  const lines = DOCUMENT.slice(start, end)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"));
  const separators = lines.filter((line) => /^\|[\s|:-]+\|$/.test(line)).length;
  return lines.length - 2 * separators;
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
