import { errors, HOTEL_IMPORT_MAX_ROWS, type HotelImportRowError } from "@ampm/core";

import {
  buildCandidate,
  decodeCsv,
  HAS_NUL,
  headerProblems,
  isBlankRow,
  NOT_UTF8,
  parseCsv,
} from "./hotel-import.js";
import type { ImportKindSpec } from "./hotel-import.kinds.js";

/*
 * Reads an uploaded file of one import kind into rows (D-181). Pure. A problem with the file as a whole
 * (not UTF-8, a null character, empty, a runaway cell or record, a quote that never closes, the headers
 * not the kind's template's, no rows or too many) refuses it with a 400 naming the file; a row that fails
 * a cell rule or the kind's row schema is reported by line and field, and the other rows go on. The header
 * is the first row that is not blank, and a row's line is its place in the file, so a blank row above the
 * header still counts.
 */

/** A row that passed its kind's schema, with its line in the file (the header is line 1). */
export interface ImportRow<Row> {
  readonly line: number;
  readonly row: Row;
}

/** A row refused before it was planned: its line, the web address and name it gives, and why. */
export interface RejectedRow extends HotelImportRowError {
  readonly slug: string | null;
  readonly name: string | null;
}

/** The file's rows: those that passed the schema, those that did not, and how many there were. */
export interface ImportFile<Row> {
  readonly rows: readonly ImportRow<Row>[];
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

const LF = 0x0a;
const CR = 0x0d;

/** The lines the reader may split the text into: a CR, an LF and a CRLF each end one. */
function lineCount(text: string): number {
  let lines = 1;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === LF || (c === CR && text.charCodeAt(i + 1) !== LF)) lines++;
  }
  return lines;
}

function fileError(problems: readonly string[]): Error {
  return errors.validation(
    problems.map((message) => ({ path: "file", message })),
    problems.join(" "),
  );
}

/**
 * The rows of an uploaded file of one kind, or a 400 for the file as a whole.
 *
 * @example
 * const { rows, rejected, totalRows } = readImportFile(bytes, ROOMS_IMPORT);
 */
export function readImportFile<Row>(bytes: Uint8Array, spec: ImportKindSpec<Row>): ImportFile<Row> {
  const text = decodeCsv(bytes);
  if (text === null) throw fileError([NOT_UTF8]);
  if (text.includes("\u0000")) throw fileError([HAS_NUL]);
  if (lineCount(text) > MAX_LINES) {
    throw fileError([`The file has more than ${MAX_LINES} lines; split it into smaller files.`]);
  }
  const parsed = parseCsv(text);
  if ("problem" in parsed) throw fileError([parsed.problem]);
  const lines = parsed.records.flatMap((cells, index) =>
    isBlankRow(cells) ? [] : [{ cells, line: index + 1 }],
  );
  const [header, ...rowLines] = lines;
  if (header === undefined) throw fileError(["The file is empty."]);
  const headers = header.cells.map((cell) => cell.trim());
  const problems = headerProblems(headers, spec.template);
  if (problems.length > 0) throw fileError(problems);
  return readRows(headers, rowLines, spec);
}

/** The rows under the header, or a 400 when there are none or too many. */
function readRows<Row>(
  headers: readonly string[],
  lines: readonly { readonly cells: readonly string[]; readonly line: number }[],
  spec: ImportKindSpec<Row>,
): ImportFile<Row> {
  if (lines.length === 0) throw fileError([`The file has no ${spec.noun} rows.`]);
  if (lines.length > HOTEL_IMPORT_MAX_ROWS) {
    throw fileError([
      `The file has ${lines.length} rows; one import takes at most ${HOTEL_IMPORT_MAX_ROWS}.`,
    ]);
  }
  const rows: ImportRow<Row>[] = [];
  const rejected: RejectedRow[] = [];
  for (const { cells, line } of lines) {
    const read = readRow(headers, cells, line, spec);
    if ("row" in read) rows.push(read);
    else rejected.push(read);
  }
  return { rows, rejected, totalRows: lines.length };
}

/** One record as a schema-valid row, or the reasons it is not one: its refused cells and schema issues. */
function readRow<Row>(
  headers: readonly string[],
  cells: readonly string[],
  line: number,
  spec: ImportKindSpec<Row>,
): ImportRow<Row> | RejectedRow {
  const candidate = buildCandidate(headers, cells, spec.template);
  const key = spec.keyOf(candidate.values);
  if (cells.slice(headers.length).some((cell) => cell.trim() !== "")) {
    return { line, ...key, errors: [{ field: "row", message: EXTRA_CELLS }] };
  }
  const parsed = spec.schema.safeParse(candidate.values);
  const issues = parsed.success
    ? []
    : parsed.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message }));
  const fieldErrors = [...candidate.problems, ...issues];
  if (parsed.success && fieldErrors.length === 0) return { line, row: parsed.data };
  return { line, ...key, errors: fieldErrors };
}
