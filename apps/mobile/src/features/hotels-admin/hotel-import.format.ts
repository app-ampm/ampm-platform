import {
  HOTEL_IMPORT_COLUMNS,
  HOTEL_IMPORT_LIST_SEPARATOR,
  HOTEL_IMPORT_MAX_BYTES,
  HOTEL_IMPORT_MAX_ROWS,
  HOTEL_IMPORT_REQUIRED_COLUMNS,
  type HotelImportResult,
  type HotelImportRowError,
  type HotelImportRowOutcome,
  type HotelImportRowReport,
} from "@ampm/core";

import { csvText } from "../admin/csv";

/*
 * Presentation helpers for the hotel CSV import (staff, TW-25; D-181). The template's columns come from
 * core, the list the server reads, so the template, the hint and the server never drift. Also a summary
 * of a result (a dry run saves nothing), a line per changing or rejected row, and the CSV text of the
 * template and of the per-row report. No fetching, no file handling (`../admin/download-csv`).
 */

/** The header row of the import template, exactly as the downloaded template carries it. */
export const IMPORT_TEMPLATE_HEADER = HOTEL_IMPORT_COLUMNS.join(",");

/** The columns as the hint lists them: spaced, so the long list wraps on a phone. */
export const IMPORT_COLUMNS_HINT = HOTEL_IMPORT_COLUMNS.join(", ");

/** The file names the downloads save as. */
export const IMPORT_TEMPLATE_FILE = "hotels-import-template.csv";
export const IMPORT_REPORT_FILE = "hotels-import-report.csv";

/** How many changing and how many rejected rows the screen lists; the downloaded report has them all. */
export const IMPORT_ROWS_SHOWN = 20;

/** The largest file, as the hint and the size check say it: "5 MB". */
const MAX_SIZE_TEXT = `${HOTEL_IMPORT_MAX_BYTES / (1024 * 1024)} MB`;

/** The rules of a file, as the hint says them under the columns. */
export const IMPORT_RULES =
  `Required: ${HOTEL_IMPORT_REQUIRED_COLUMNS.join(", ")}. On a hotel already in the catalogue a ` +
  "blank cell leaves its value unchanged; status and the demo, showcase and internal columns change " +
  `only when filled. Separate the entries of a list cell with "${HOTEL_IMPORT_LIST_SEPARATOR}" or a ` +
  "line break; a comma stays inside an entry. " +
  "Yes-or-no columns take true or false (yes and no, or 1 and 0, work too). Use the template's " +
  `column names: an unknown column is refused. Up to ${MAX_SIZE_TEXT} and ` +
  `${HOTEL_IMPORT_MAX_ROWS.toLocaleString("en-IN")} rows. Save the file as CSV UTF-8 (in Excel: ` +
  "CSV UTF-8): plain CSV turns ₹ and Indic names into question marks. Validate first: it checks the " +
  "file and saves nothing.";

/**
 * The byte-order mark that tells Excel a CSV is UTF-8, so it opens the template, and saves it again, as
 * CSV UTF-8 rather than in the system code page, which writes ₹ or an Indic name as "?". The server and
 * a browser reading the file both drop it.
 */
const UTF8_BOM = "\uFEFF";

/**
 * The template: the header row alone, so no example row can be imported by mistake, marked as UTF-8.
 *
 * @example
 * importTemplateCsv(); // "\uFEFFdestinationSlug,destinationName,slug,name,…"
 */
export function importTemplateCsv(): string {
  return `${UTF8_BOM}${csvText([HOTEL_IMPORT_COLUMNS])}`;
}

/** The size of the text as the upload sends it, UTF-8. */
export function utf8Length(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code < 0x10000) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

/** Whether the file is over the server's 5 MB cap, so it is refused before it is sent. */
export function isOverImportLimit(text: string): boolean {
  return utf8Length(text) > HOTEL_IMPORT_MAX_BYTES;
}

/** What the screen says when the chosen file is over the cap, so it was not read. */
export function oversizeFileNotice(fileName: string): string {
  return `${fileName} is over ${MAX_SIZE_TEXT}: split it into smaller files`;
}

/** Why the CSV cannot be sent as it is (nothing there, or over the cap), or null when it can. */
export function importInputProblem(csv: string): string | null {
  if (csv.trim().length === 0) return "Paste or choose a CSV first";
  if (isOverImportLimit(csv)) {
    return `The CSV is over ${MAX_SIZE_TEXT}: split it into smaller files`;
  }
  return null;
}

/** A count with its noun, singular for one: "1 row", "3 new destinations". */
function counted(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function rows(count: number): string {
  return counted(count, "row");
}

/**
 * What a dry run's destinations would become: "would add 1 new destination", or null when the file names
 * none that is missing. Importing creates each one active, so a typo in a slug shows here first.
 */
function newDestinationsText(result: HotelImportResult): string | null {
  const count = result.destinationsCreated;
  return count > 0 ? `would add ${counted(count, "new destination")}` : null;
}

/**
 * The note a validate's toast carries when importing would create destinations, or null.
 *
 * @example
 * dryRunDestinationsNote(result); // "Importing would add 1 new destination."
 */
export function dryRunDestinationsNote(result: HotelImportResult): string | null {
  const text = result.dryRun ? newDestinationsText(result) : null;
  return text ? `Importing ${text}.` : null;
}

function dryRunSummary(result: HotelImportResult): string {
  const counts = [
    `${result.created} to add`,
    `${result.updated} to update`,
    `${result.unchanged} unchanged`,
    `${result.rejected.length} rejected`,
  ];
  const destinations = newDestinationsText(result);
  const tail = destinations ? `${destinations}; nothing saved yet` : "nothing saved yet";
  return `Checked ${rows(result.totalRows)}: ${counts.join(", ")} — ${tail}.`;
}

function nothingImportedSummary(result: HotelImportResult): string {
  const rejected = result.rejected.length;
  if (rejected >= result.totalRows) {
    const verb = result.totalRows === 1 ? "was" : "were";
    return `Nothing imported — all ${rows(result.totalRows)} ${verb} rejected.`;
  }
  const parts = [`${result.unchanged} unchanged`];
  if (rejected > 0) parts.push(`${rejected} rejected`);
  return `Nothing imported — ${parts.join(", ")}.`;
}

/**
 * A one-line summary of an import result: a dry run reports what would happen and saves nothing; a real
 * run that wrote nothing (`applied` false: every row unchanged or rejected) says so.
 */
export function importSummary(result: HotelImportResult): string {
  if (result.dryRun) return dryRunSummary(result);
  if (!result.applied) return nothingImportedSummary(result);
  const parts = [`${result.created} created`, `${result.updated} updated`];
  if (result.unchanged > 0) parts.push(`${result.unchanged} unchanged`);
  if (result.destinationsCreated > 0) {
    parts.push(counted(result.destinationsCreated, "new destination"));
  }
  if (result.mediaRegistered > 0) parts.push(counted(result.mediaRegistered, "image"));
  return `Imported ${parts.join(" · ")}.`;
}

/** Whether the result carries rejected rows worth showing. */
export function hasRejections(result: HotelImportResult): boolean {
  return result.rejected.length > 0;
}

/** A headline for the rejected block, e.g. "2 of 50 rows rejected", or null when none were. */
export function rejectedHeadline(result: HotelImportResult): string | null {
  if (result.rejected.length === 0) return null;
  return `${result.rejected.length} of ${rows(result.totalRows)} rejected`;
}

/** One rejected row as a line: "Line 5: destinationSlug — required; website — invalid url". */
export function rejectedRowText(row: HotelImportRowError): string {
  const fields = row.errors.map((error) => `${error.field} — ${error.message}`).join("; ");
  return `Line ${row.line}: ${fields}`;
}

/** The rows that add or update a hotel, in file order. */
export function changingRows(result: HotelImportResult): HotelImportRowReport[] {
  return result.rows
    .filter((row) => row.outcome === "create" || row.outcome === "update")
    .sort((a, b) => a.line - b.line);
}

/** A headline for the changing block, e.g. "3 hotels to add or update", or null when none would. */
export function changingHeadline(result: HotelImportResult): string | null {
  const count = changingRows(result).length;
  if (count === 0) return null;
  const noun = count === 1 ? "hotel" : "hotels";
  return result.dryRun ? `${count} ${noun} to add or update` : `${count} ${noun} added or updated`;
}

const OUTCOME_LABEL: Record<HotelImportRowOutcome, string> = {
  create: "New hotel",
  update: "Update",
  unchanged: "Unchanged",
  error: "Rejected",
};

/** One changing row as a line: "Line 3 · synthetic-lake-hotel · Update: city, mapsUrl". */
export function rowOutcomeText(row: HotelImportRowReport): string {
  const fields = row.changedFields.length > 0 ? `: ${row.changedFields.join(", ")}` : "";
  const place = row.slug ? ` · ${row.slug}` : "";
  return `Line ${row.line}${place} · ${OUTCOME_LABEL[row.outcome]}${fields}`;
}

/** "N more in the report" under a capped list, or null when every row is shown. */
export function moreRowsText(total: number): string | null {
  const hidden = total - IMPORT_ROWS_SHOWN;
  return hidden > 0 ? `${hidden} more in the downloaded report.` : null;
}

interface ReportLine {
  readonly line: number;
  readonly slug: string;
  readonly outcome: HotelImportRowOutcome;
  readonly changedFields: string;
  readonly errors: string;
}

function reportLines(result: HotelImportResult): ReportLine[] {
  const errorsByLine = new Map(result.rejected.map((row) => [row.line, row.errors]));
  const lines: ReportLine[] = result.rows.map((row) => ({
    line: row.line,
    slug: row.slug ?? "",
    outcome: row.outcome,
    changedFields: row.changedFields.join(", "),
    errors: (errorsByLine.get(row.line) ?? []).map((e) => `${e.field}: ${e.message}`).join("; "),
  }));
  // A rejected row the report does not list still belongs in the file.
  for (const row of result.rejected) {
    if (lines.some((line) => line.line === row.line)) continue;
    const errors = row.errors.map((e) => `${e.field}: ${e.message}`).join("; ");
    lines.push({ line: row.line, slug: "", outcome: "error", changedFields: "", errors });
  }
  return lines.sort((a, b) => a.line - b.line);
}

/**
 * The per-row report as CSV: each row's line, web address, outcome, the columns it changes and its
 * errors, so staff can fix the rejected rows in their spreadsheet. Cells are formula-guarded.
 *
 * @example
 * importReportCsv(result); // "line,slug,outcome,changedFields,errors\r\n3,synthetic-lake-hotel,update,city,"
 */
export function importReportCsv(result: HotelImportResult): string {
  const body = reportLines(result).map((line) => [
    String(line.line),
    line.slug,
    line.outcome,
    line.changedFields,
    line.errors,
  ]);
  return csvText([["line", "slug", "outcome", "changedFields", "errors"], ...body]);
}
