import {
  hotelImportEnumValue,
  hotelListEntries,
  isNumberRangeCell,
  parseVenueLayoutsCell,
  VENUE_CAPACITY_RANGE_MESSAGE,
  VENUE_LAYOUTS_CELL_MESSAGE,
  type HotelImportTemplate,
} from "@ampm/core";

/*
 * Pure helpers for the staff spreadsheet import (TW-25; AC-35.1; D-181), for every kind. No Nest, no
 * Prisma, so they test in isolation. `decodeCsv` turns the uploaded bytes into text, refusing anything but
 * UTF-8. `parseCsv` is a small RFC-4180 state machine (quoted fields, escaped `""`, embedded commas and
 * newlines; a record ends at LF, CR or CRLF) that holds memory near the file's size and reads a quote as
 * spreadsheets do: one opens a quoted cell only at the cell's start, and a quoted cell that never closes
 * refuses the file rather than swallow the rows below it. `headerProblems` holds the file to its kind's
 * fixed headers (core `HOTEL_IMPORT_TEMPLATES`). `buildCandidate` turns one row into a typed object ready
 * for the kind's row schema: a blank cell is left out, which on an update means "leave this unchanged";
 * number, true/false, list, enum and other-layout cells are converted as the template says; a value that
 * does not convert falls through as its string, so the schema reports a clear field error, except a
 * capacity range and an unreadable layouts cell, which are refused on their column with their own words.
 */

/** Why a file that is not UTF-8 text is refused. */
export const NOT_UTF8 = "Save the file as UTF-8 CSV (in Excel: CSV UTF-8) and upload it again";

/**
 * Why a file holding the null character is refused: no database text column can store it. Text copied
 * from a PDF can carry one, and a UTF-16 file read as UTF-8 is full of them.
 */
export const HAS_NUL =
  "The file holds a null character, which text copied from a PDF or a UTF-16 file can carry; remove it, save the file as UTF-8 CSV and upload it again";

/**
 * The uploaded bytes as text: UTF-8 only, its byte-order mark dropped, in Unicode's composed form (NFC),
 * so a name spelt with a combining accent, as text copied from some PDFs arrives, reads as the same name
 * typed in the staff app (the stored names are compared in NFC too). Null when the bytes are not valid
 * UTF-8 or carry the replacement character, the trace a browser leaves when it reads another encoding as
 * UTF-8 (Excel's plain "CSV" is Windows-1252). Composing never touches a comma, a quote or a line break.
 *
 * @example
 * decodeCsv(new TextEncoder().encode("\uFEFFdestinationSlug,name")); // "destinationSlug,name"
 * decodeCsv(new TextEncoder().encode("name\nCafe\u0301")); // "name\nCaf\u00e9"
 */
export function decodeCsv(bytes: Uint8Array): string | null {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
  return text.includes("\uFFFD") ? null : text.normalize("NFC");
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
const SPACE = 0x20;
const TAB = 0x09;

/**
 * Reads CSV text into records. Each run of plain characters is taken with one slice, never a character
 * at a time (one string per character held about 170 MB for a 5 MiB cell), and a cell over
 * {@link CSV_MAX_CELL_LENGTH} characters, a record over {@link CSV_MAX_CELLS} cells or a quote that never
 * closes stops the read. A quote opens quotes only before anything but blanks in its cell, so `55" TV`
 * is text, as Excel and Python's csv read it; inside quotes `""` is one quote. LF, CR and CRLF each end
 * a record (Excel for Mac ends them with CR alone).
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
  /** Whether the cell holds anything but blanks yet: after that a quote is text. */
  private started = false;

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

  /**
   * Outside quotes a comma ends a cell, and LF, CR or CRLF a record; a quote opens quotes when it starts
   * the cell (blanks aside), and is text anywhere else.
   */
  private plain(i: number): number | string {
    const c = this.text.charCodeAt(i);
    if (c === QUOTE && !this.started) return this.openQuotes(i);
    if (c !== COMMA && c !== LF && c !== CR) {
      if (c !== SPACE && c !== TAB) this.started = true;
      return i + 1;
    }
    const problem = this.take(i) ?? this.endCell();
    if (problem !== null) return problem;
    if (c !== COMMA) this.endRecord();
    this.start = c === CR && this.text.charCodeAt(i + 1) === LF ? i + 2 : i + 1;
    return this.start;
  }

  private openQuotes(i: number): number | string {
    const problem = this.take(i);
    if (problem !== null) return problem;
    this.inQuotes = true;
    this.started = true;
    this.start = i + 1;
    return this.start;
  }

  /** Adds the plain run that ends before `end` to the cell. */
  private take(end: number): string | null {
    return end > this.start ? this.add(this.text.slice(this.start, end)) : null;
  }

  private add(piece: string): string | null {
    this.parts.push(piece);
    this.cellLength += piece.length;
    if (this.cellLength <= CSV_MAX_CELL_LENGTH) return null;
    const hint = this.inQuotes ? ", so check that its closing quote is there" : "";
    return `Line ${this.line()} has a cell longer than ${CSV_MAX_CELL_LENGTH.toLocaleString("en-IN")} characters; no column takes one that long${hint}.`;
  }

  private endCell(): string | null {
    this.record.push(this.parts.join(""));
    this.parts = [];
    this.cellLength = 0;
    this.started = false;
    if (this.record.length <= CSV_MAX_CELLS) return null;
    return `Line ${this.line()} has more than ${CSV_MAX_CELLS} cells; no import template has that many columns.`;
  }

  private endRecord(): void {
    this.records.push(this.record);
    this.record = [];
  }

  /** The record being read, counted from 1 (a record's cells may run over several lines). */
  private line(): number {
    return this.records.length + 1;
  }

  /** The last record, unless the text ended with its line break; refused while a quote is open. */
  private finish(): string | null {
    if (this.inQuotes) {
      return `Line ${this.line()} opens a quote that never closes; close the quoted cell, or remove the quote.`;
    }
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

/** A template's cell rules as sets, built once per template. */
interface CellRules {
  readonly known: ReadonlySet<string>;
  readonly required: readonly string[];
  readonly numbers: ReadonlySet<string>;
  readonly booleans: ReadonlySet<string>;
  readonly lists: ReadonlySet<string>;
  readonly enums: ReadonlySet<string>;
  readonly layouts: ReadonlySet<string>;
  readonly capacities: ReadonlySet<string>;
}

const RULES = new WeakMap<HotelImportTemplate, CellRules>();

function rulesOf(template: HotelImportTemplate): CellRules {
  const known = RULES.get(template);
  if (known) return known;
  const rules: CellRules = {
    known: new Set(template.columns),
    required: template.requiredColumns,
    numbers: new Set(template.numberColumns),
    booleans: new Set(template.booleanColumns),
    lists: new Set(template.listColumns),
    enums: new Set(template.enumColumns),
    layouts: new Set(template.layoutColumns),
    capacities: new Set(template.capacityColumns),
  };
  RULES.set(template, rules);
  return rules;
}

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
 * What is wrong with a file's header row, one sentence each, or nothing. The headers are the kind's
 * template's, fixed (D-181): an unknown, blank or repeated header is refused, and the required columns
 * must be there.
 *
 * @example
 * headerProblems(["destinationSlug", "name", "mystery"], HOTEL_IMPORT_TEMPLATES.hotels); // ["Unknown column(s): mystery. …"]
 */
export function headerProblems(
  headers: readonly string[],
  template: HotelImportTemplate,
): string[] {
  const rules = rulesOf(template);
  const blank = headers.flatMap((header, index) => (header === "" ? [index + 1] : []));
  const unknown = headers.filter((header) => header !== "" && !rules.known.has(header));
  const repeated = repeatedHeaders(headers);
  const missing = rules.required.filter((column) => !headers.includes(column));
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

/** One cell as its column's value (undefined when a list cell holds no entries), or why it is refused. */
type CellRead = { readonly value: unknown } | { readonly problem: string };

/** A number cell: a capacity takes one number, so a range there is refused with its own words. */
function numberCell(column: string, raw: string, rules: CellRules): CellRead {
  if (rules.capacities.has(column) && isNumberRangeCell(raw)) {
    return { problem: VENUE_CAPACITY_RANGE_MESSAGE };
  }
  const num = Number(raw);
  return { value: Number.isNaN(num) ? raw : num };
}

/** A list cell's entries, or undefined when it holds none. */
const entriesOrUndefined = <T>(entries: readonly T[]): readonly T[] | undefined =>
  entries.length > 0 ? entries : undefined;

/**
 * One non-blank cell as its column's type. A list cell's entries are split at each "|" and line break
 * (core `hotelListEntries`), the rule the staff editor's one-per-line lists share; an enum cell is read in
 * any case with spaces and hyphens as underscores (`hotelImportEnumValue`); an other-layouts cell is
 * `Name: max | Name: min-max` (`parseVenueLayoutsCell`).
 */
function cellValue(column: string, raw: string, rules: CellRules): CellRead {
  if (rules.numbers.has(column)) return numberCell(column, raw, rules);
  if (rules.booleans.has(column)) return { value: coerceBoolean(raw) };
  if (rules.enums.has(column)) return { value: hotelImportEnumValue(raw) };
  if (rules.lists.has(column)) return { value: entriesOrUndefined(hotelListEntries(raw)) };
  if (rules.layouts.has(column)) {
    const layouts = parseVenueLayoutsCell(raw);
    return layouts === null
      ? { problem: VENUE_LAYOUTS_CELL_MESSAGE }
      : { value: entriesOrUndefined(layouts) };
  }
  return { value: raw };
}

/** One row as typed cells, and the cells refused before the schema reads them, by column. */
export interface CandidateRow {
  readonly values: Record<string, unknown>;
  readonly problems: readonly { readonly field: string; readonly message: string }[];
}

/**
 * One row as the object its kind's row schema checks, and the cells refused on the way (a capacity range,
 * an unreadable layouts cell), which are left out of the object. A blank cell is left out too (on an
 * update the column stays as it is; a blank never clears). The headers have passed `headerProblems`.
 *
 * @example
 * buildCandidate(["destinationSlug", "name", "cuisines"], ["udaipur", "X", "Indian | Italian"], HOTEL_IMPORT_TEMPLATES.hotels);
 * // { values: { destinationSlug: "udaipur", name: "X", cuisines: ["Indian", "Italian"] }, problems: [] }
 */
export function buildCandidate(
  headers: readonly string[],
  cells: readonly string[],
  template: HotelImportTemplate,
): CandidateRow {
  const rules = rulesOf(template);
  const values: Record<string, unknown> = {};
  const problems: { field: string; message: string }[] = [];
  headers.forEach((header, index) => {
    const raw = (cells[index] ?? "").trim();
    if (raw === "") return;
    const read = cellValue(header, raw, rules);
    if ("problem" in read) problems.push({ field: header, message: read.problem });
    else if (read.value !== undefined) values[header] = read.value;
  });
  return { values, problems };
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
