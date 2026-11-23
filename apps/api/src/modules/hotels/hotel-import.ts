import {
  HOTEL_IMPORT_BOOLEAN_COLUMNS,
  HOTEL_IMPORT_COLUMNS,
  HOTEL_IMPORT_LIST_COLUMNS,
  HOTEL_IMPORT_NUMBER_COLUMNS,
  HOTEL_IMPORT_REQUIRED_COLUMNS,
  hotelListEntries,
} from "@ampm/core";

/*
 * Pure helpers for the hotel spreadsheet import (TW-25; AC-35.1; D-181). No Nest, no Prisma, so they test
 * in isolation. `decodeCsv` turns the uploaded bytes into text, refusing anything but UTF-8. `parseCsv` is
 * a small RFC-4180 state machine (quoted fields, escaped `""`, embedded commas and newlines, CRLF) that
 * holds memory near the file's size. `headerProblems` holds the file to the template's fixed headers.
 * `buildCandidate` turns one row into a typed object ready for `hotelImportRow`: a blank cell is left out,
 * which on an update means "leave this unchanged"; number, true/false and list columns are converted; a
 * value that does not convert falls through as its string, so the schema reports a clear field error.
 */

/** Why a file that is not UTF-8 text is refused. */
export const NOT_UTF8 = "Save the file as UTF-8 CSV (in Excel: CSV UTF-8) and upload it again";

/**
 * The uploaded bytes as text: UTF-8 only, its byte-order mark dropped. Null when the bytes are not valid
 * UTF-8 or carry the replacement character, the trace a browser leaves when it reads another encoding as
 * UTF-8 (Excel's plain "CSV" is Windows-1252).
 *
 * @example
 * decodeCsv(new TextEncoder().encode("\uFEFFdestinationSlug,name")); // "destinationSlug,name"
 */
export function decodeCsv(bytes: Uint8Array): string | null {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
  return text.includes("\uFFFD") ? null : text;
}

/**
 * The longest cell a file may hold: twice the widest column (an address, a description or notes take
 * 10,000 characters), so a cell a little over its column is a row error and only a runaway one refuses
 * the file.
 */
export const CSV_MAX_CELL_LENGTH = 20_000;

/** The most cells one record may hold: room for stray trailing commas beside the template's columns. */
export const CSV_MAX_CELLS = 200;

/** A CSV text's records, or why the read stopped part-way. */
export type CsvRecords = { readonly records: string[][] } | { readonly problem: string };

const QUOTE = 0x22;
const COMMA = 0x2c;
const LF = 0x0a;
const CR = 0x0d;

/**
 * Reads CSV text into records. Each run of plain characters is taken with one slice, never a character
 * at a time (one string per character held about 170 MB for a 5 MiB cell), and a cell over
 * {@link CSV_MAX_CELL_LENGTH} characters or a record over {@link CSV_MAX_CELLS} cells stops the read.
 * Outside quotes a quote opens them and a carriage return is dropped; inside, `""` is one quote.
 *
 * @example
 * parseCsv('name,note\n"Lake, Palace",x'); // { records: [["name", "note"], ["Lake, Palace", "x"]] }
 */
export function parseCsv(text: string): CsvRecords {
  return new CsvReader(text).read();
}

class CsvReader {
  private readonly records: string[][] = [];
  private record: string[] = [];
  private parts: string[] = [];
  private cellLength = 0;
  private start = 0;
  private inQuotes = false;

  constructor(private readonly text: string) {}

  read(): CsvRecords {
    let i = 0;
    while (i < this.text.length) {
      const next = this.inQuotes ? this.quoted(i) : this.plain(i);
      if (typeof next === "string") return { problem: next };
      i = next;
    }
    const problem = this.finish();
    return problem === null ? { records: this.records } : { problem };
  }

  /** Inside quotes only a quote matters: `""` is a literal quote, a lone one closes the quotes. */
  private quoted(i: number): number | string {
    if (this.text.charCodeAt(i) !== QUOTE) return i + 1;
    const escaped = this.text.charCodeAt(i + 1) === QUOTE;
    const problem = this.take(i) ?? (escaped ? this.add('"') : null);
    if (problem !== null) return problem;
    if (!escaped) this.inQuotes = false;
    this.start = escaped ? i + 2 : i + 1;
    return this.start;
  }

  /** Outside quotes a comma ends a cell, a line feed a record; a quote opens quotes; a CR is dropped. */
  private plain(i: number): number | string {
    const c = this.text.charCodeAt(i);
    if (c !== QUOTE && c !== COMMA && c !== LF && c !== CR) return i + 1;
    const problem = this.take(i) ?? (c === COMMA || c === LF ? this.endCell() : null);
    if (problem !== null) return problem;
    if (c === QUOTE) this.inQuotes = true;
    if (c === LF) this.endRecord();
    this.start = i + 1;
    return i + 1;
  }

  /** Adds the plain run that ends before `end` to the cell. */
  private take(end: number): string | null {
    return end > this.start ? this.add(this.text.slice(this.start, end)) : null;
  }

  private add(piece: string): string | null {
    this.parts.push(piece);
    this.cellLength += piece.length;
    if (this.cellLength <= CSV_MAX_CELL_LENGTH) return null;
    return `Line ${this.records.length + 1} has a cell longer than ${CSV_MAX_CELL_LENGTH.toLocaleString("en-IN")} characters; no column takes one that long.`;
  }

  private endCell(): string | null {
    this.record.push(this.parts.join(""));
    this.parts = [];
    this.cellLength = 0;
    if (this.record.length <= CSV_MAX_CELLS) return null;
    return `Line ${this.records.length + 1} has more than ${CSV_MAX_CELLS} cells; the template has ${HOTEL_IMPORT_COLUMNS.length} columns.`;
  }

  private endRecord(): void {
    this.records.push(this.record);
    this.record = [];
  }

  /** The last record, unless the text ended with its line feed. */
  private finish(): string | null {
    const problem = this.take(this.text.length);
    if (problem !== null) return problem;
    if (this.parts.length === 0 && this.record.length === 0) return null;
    const cellProblem = this.endCell();
    if (cellProblem !== null) return cellProblem;
    this.endRecord();
    return null;
  }
}

/** A row is blank (a spreadsheet's trailing empty line) when every cell is empty after trimming. */
export function isBlankRow(cells: readonly string[]): boolean {
  return cells.every((cell) => cell.trim() === "");
}

const KNOWN_COLUMNS = new Set<string>(HOTEL_IMPORT_COLUMNS);
const NUMBER_COLUMNS = new Set<string>(HOTEL_IMPORT_NUMBER_COLUMNS);
const BOOLEAN_COLUMNS = new Set<string>(HOTEL_IMPORT_BOOLEAN_COLUMNS);
const LIST_COLUMNS = new Set<string>(HOTEL_IMPORT_LIST_COLUMNS);
/** How many headers a refusal names, and how much of each, so a stray file cannot flood it. */
const NAMED_HEADERS_MAX = 10;
const NAMED_HEADER_LENGTH = 60;

const named = (values: readonly (string | number)[]): string =>
  values
    .slice(0, NAMED_HEADERS_MAX)
    .map((value) => String(value).slice(0, NAMED_HEADER_LENGTH))
    .join(", ");

/** The headers that appear more than once, each named once (one pass, however wide the row). */
function repeatedHeaders(headers: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const header of headers) {
    if (header !== "" && seen.has(header)) repeated.add(header);
    seen.add(header);
  }
  return [...repeated];
}

/**
 * What is wrong with a file's header row, one sentence each, or nothing. The headers are the template's,
 * fixed (D-181): an unknown, blank or repeated header is refused, and the required columns must be there.
 *
 * @example
 * headerProblems(["destinationSlug", "name", "mystery"]); // ["Unknown column(s): mystery. …"]
 */
export function headerProblems(headers: readonly string[]): string[] {
  const blank = headers.flatMap((header, index) => (header === "" ? [index + 1] : []));
  const unknown = headers.filter((header) => header !== "" && !KNOWN_COLUMNS.has(header));
  const repeated = repeatedHeaders(headers);
  const missing = HOTEL_IMPORT_REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
  const problems: string[] = [];
  if (blank.length > 0) problems.push(`Column(s) ${named(blank)} have no header.`);
  if (unknown.length > 0) {
    problems.push(`Unknown column(s): ${named(unknown)}. Use the template's headers.`);
  }
  if (repeated.length > 0) problems.push(`Column(s) given twice: ${named(repeated)}.`);
  if (missing.length > 0) problems.push(`Missing column(s): ${missing.join(", ")}.`);
  return problems;
}

function coerceBoolean(raw: string): boolean | string {
  const s = raw.toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return raw; // a non-boolean value falls through so z.boolean() reports it
}

/**
 * One non-blank cell as its column's type; undefined when a list cell holds no entries. A list cell's
 * entries are split at each "|" and line break (core `hotelListEntries`), the rule the staff editor's
 * one-per-line lists share, so a list one of them saves reads back the same through the other.
 */
function cellValue(column: string, raw: string): unknown {
  if (NUMBER_COLUMNS.has(column)) {
    const num = Number(raw);
    return Number.isNaN(num) ? raw : num;
  }
  if (BOOLEAN_COLUMNS.has(column)) return coerceBoolean(raw);
  if (LIST_COLUMNS.has(column)) {
    const entries = hotelListEntries(raw);
    return entries.length > 0 ? entries : undefined;
  }
  return raw;
}

/**
 * One row as the object `hotelImportRow` checks. A blank cell is left out (on an update the column stays
 * as it is; a blank never clears). The headers have passed `headerProblems`.
 *
 * @example
 * buildCandidate(["destinationSlug", "name", "cuisines"], ["udaipur", "X", "Indian | Italian"]);
 * // { destinationSlug: "udaipur", name: "X", cuisines: ["Indian", "Italian"] }
 */
export function buildCandidate(
  headers: readonly string[],
  cells: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  headers.forEach((header, index) => {
    const raw = (cells[index] ?? "").trim();
    if (raw === "") return;
    const value = cellValue(header, raw);
    if (value !== undefined) out[header] = value;
  });
  return out;
}

/** Lowercase a name into a slug (`The Lake Pavilion` → `the-lake-pavilion`); matches the `slug` contract. */
export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Title-case a slug into a display name when an import creates a destination without one (`goa` → `Goa`). */
export function titleCaseSlug(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
