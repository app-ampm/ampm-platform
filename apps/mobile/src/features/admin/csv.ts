/*
 * CSV text for the staff workspace's exports (the audit log, Finance & Reports): RFC-4180 quoting and
 * CRLF lines, so a spreadsheet opens it as written. No fetching, no file handling (`download-csv`).
 */

/**
 * A leading `=`, `+`, `-`, `@`, tab or carriage return makes a spreadsheet read the cell as a formula
 * (CSV injection); exports carry names people typed, so such a cell is kept as text with a leading `'`.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

/** One field: kept as text when it would start a formula, quoted when it holds a comma, quote or newline. */
export function csvCell(value: string): string {
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Rows of fields as CSV text: one line per row, CRLF between them.
 *
 * @example
 * csvText([["Account", "Plan"], ["Nisha & Arjun", "Hotel Discovery"]]);
 */
export function csvText(rows: readonly (readonly string[])[]): string {
  return rows.map((cells) => cells.map(csvCell).join(",")).join("\r\n");
}
