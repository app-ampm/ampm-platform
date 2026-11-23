import {
  errors,
  hotelImportRow,
  HOTEL_IMPORT_MAX_ROWS,
  type HotelImportRow,
  type HotelImportRowError,
} from "@ampm/core";

import {
  buildCandidate,
  decodeCsv,
  headerProblems,
  isBlankRow,
  NOT_UTF8,
  parseCsv,
  slugify,
} from "./hotel-import.js";

/*
 * Reads an uploaded hotels file into rows (D-181). Pure. A problem with the file as a whole (not UTF-8,
 * empty, a runaway cell or record, the headers not the template's, too many rows) refuses it with a 400
 * naming the file; a row that fails the schema is reported by line and field, and the other rows go on.
 */

/** A row that passed the schema, with its line in the file (the header is line 1). */
export interface ImportRow {
  readonly line: number;
  readonly row: HotelImportRow;
}

/** A row the schema refused: its line, the web address it names if it names one, and why. */
export interface RejectedRow extends HotelImportRowError {
  readonly slug: string | null;
}

/** The file's rows: those that passed the schema, those that did not, and how many there were. */
export interface ImportFile {
  readonly rows: readonly ImportRow[];
  readonly rejected: readonly RejectedRow[];
  readonly totalRows: number;
}

/** A cell past the header row's last column, which an unquoted comma in a cell leaves behind. */
const EXTRA_CELLS =
  "This row has more cells than the file has columns; put any cell that holds a comma in quotes";

/**
 * The most lines a file may have, counted before it is split into rows: room for cells that run over
 * several lines, while a 5 MiB file of empty lines cannot make the parser hold millions of rows.
 */
const MAX_LINES = HOTEL_IMPORT_MAX_ROWS * 50;

function lineCount(text: string): number {
  let lines = 1;
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) lines++;
  return lines;
}

function fileError(problems: readonly string[]): Error {
  return errors.validation(
    problems.map((message) => ({ path: "file", message })),
    problems.join(" "),
  );
}

/**
 * The rows of an uploaded hotels file, or a 400 for the file as a whole.
 *
 * @example
 * const { rows, rejected, totalRows } = readHotelImportFile(bytes);
 */
export function readHotelImportFile(bytes: Uint8Array): ImportFile {
  const text = decodeCsv(bytes);
  if (text === null) throw fileError([NOT_UTF8]);
  if (lineCount(text) > MAX_LINES) {
    throw fileError([`The file has more than ${MAX_LINES} lines; split it into smaller files.`]);
  }
  const parsed = parseCsv(text);
  if ("problem" in parsed) throw fileError([parsed.problem]);
  const [header, ...records] = parsed.records;
  if (header === undefined || isBlankRow(header)) throw fileError(["The file is empty."]);
  const headers = header.map((cell) => cell.trim());
  const problems = headerProblems(headers);
  if (problems.length > 0) throw fileError(problems);
  const lines = records.flatMap((cells, index) =>
    isBlankRow(cells) ? [] : [{ cells, line: index + 2 }],
  );
  if (lines.length > HOTEL_IMPORT_MAX_ROWS) {
    throw fileError([
      `The file has ${lines.length} rows; one import takes at most ${HOTEL_IMPORT_MAX_ROWS}.`,
    ]);
  }
  const rows: ImportRow[] = [];
  const rejected: RejectedRow[] = [];
  for (const { cells, line } of lines) {
    const read = readRow(headers, cells, line);
    if ("row" in read) rows.push(read);
    else rejected.push(read);
  }
  return { rows, rejected, totalRows: lines.length };
}

/** One record as a schema-valid row, or the reasons it is not one. */
function readRow(
  headers: readonly string[],
  cells: readonly string[],
  line: number,
): ImportRow | RejectedRow {
  const candidate = buildCandidate(headers, cells);
  if (cells.slice(headers.length).some((cell) => cell.trim() !== "")) {
    return { line, slug: slugOf(candidate), errors: [{ field: "row", message: EXTRA_CELLS }] };
  }
  const parsed = hotelImportRow.safeParse(candidate);
  if (parsed.success) return { line, row: parsed.data };
  const fieldErrors = parsed.error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
  return { line, slug: slugOf(candidate), errors: fieldErrors };
}

/** The web address a refused row names: its slug cell, else one made from its name. */
function slugOf(candidate: Record<string, unknown>): string | null {
  const { slug, name } = candidate;
  if (typeof slug === "string") return slug;
  return typeof name === "string" ? slugify(name) || null : null;
}
