import {
  HOTEL_IMPORT_MAX_BYTES,
  HOTEL_IMPORT_TEMPLATES,
  type HotelImportKind,
  type HotelImportResult,
  type HotelImportRowError,
  type HotelImportRowOutcome,
  type HotelImportRowReport,
} from "@ampm/core";

import { csvText } from "../admin/csv";
import { IMPORT_KIND_COPY, kindCount } from "./hotel-import.kinds";
import { MAX_SIZE_TEXT } from "./hotel-import.rules";

/*
 * Presentation helpers for the staff CSV import (TW-25; D-181), for each kind it imports. A kind's
 * template columns come from core, the lists the server reads, so the template, the help and the server
 * never drift. Also a summary of a result (a preview saves nothing), a line per changing or rejected
 * row (with the room's or venue's name), and the CSV text of the template and of the per-row report.
 * A result names its own kind. No fetching, no file handling (`../admin/download-csv`).
 */

/**
 * A kind's columns as the help lists them: spaced, so the long list wraps on a phone.
 *
 * @example
 * importColumnsHint("rooms"); // "hotelSlug, name, roomCount, unitType, …"
 */
export function importColumnsHint(kind: HotelImportKind): string {
  return HOTEL_IMPORT_TEMPLATES[kind].columns.join(", ");
}

/** How many changing and how many rejected rows the screen lists; the downloaded report has them all. */
export const IMPORT_ROWS_SHOWN = 20;

/**
 * The byte-order mark that tells Excel a CSV is UTF-8, so it opens the template, and saves it again, as
 * CSV UTF-8 rather than in the system code page, which writes ₹ or an Indic name as "?". The server and
 * a browser reading the file both drop it.
 */
const UTF8_BOM = "\uFEFF";

/**
 * A kind's template: the header row alone, so no example row can be imported by mistake, marked as
 * UTF-8.
 *
 * @example
 * importTemplateCsv("hotels"); // "\uFEFFdestinationSlug,destinationName,slug,name,…"
 */
export function importTemplateCsv(kind: HotelImportKind): string {
  return `${UTF8_BOM}${csvText([HOTEL_IMPORT_TEMPLATES[kind].columns])}`;
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

/** The rows that add or update a record, in file order. */
export function changingRows(result: HotelImportResult): HotelImportRowReport[] {
  return result.rows
    .filter((row) => row.outcome === "create" || row.outcome === "update")
    .sort((a, b) => a.line - b.line);
}

/** Whether a preview would create or update anything, so its Import can write something. */
export function hasChanges(result: HotelImportResult): boolean {
  return result.created + result.updated > 0;
}

/** A headline for the changing block, e.g. "3 venues to add or update", or null when none would. */
export function changingHeadline(result: HotelImportResult): string | null {
  const count = changingRows(result).length;
  if (count === 0) return null;
  const counted = kindCount(result.kind, count);
  return result.dryRun ? `${counted} to add or update` : `${counted} added or updated`;
}

function outcomeLabel(kind: HotelImportKind, outcome: HotelImportRowOutcome): string {
  if (outcome === "create") return IMPORT_KIND_COPY[kind].createLabel;
  if (outcome === "update") return "Update";
  return outcome === "unchanged" ? "Unchanged" : "Rejected";
}

/** Whether a kind's rows are named apart from their hotel: a room's or a venue's name. */
function namesRows(kind: HotelImportKind): boolean {
  return kind !== "hotels";
}

/**
 * One changing row of a result as a line, with the room's or venue's name after its hotel's address.
 *
 * @example
 * rowOutcomeText(row, "venues"); // "Line 3 · synthetic-lake-hotel · Synthetic Lawn · Update: setting"
 */
export function rowOutcomeText(row: HotelImportRowReport, kind: HotelImportKind): string {
  const fields = row.changedFields.length > 0 ? `: ${row.changedFields.join(", ")}` : "";
  const place = row.slug ? ` · ${row.slug}` : "";
  const name = namesRows(kind) && row.name ? ` · ${row.name}` : "";
  return `Line ${row.line}${place}${name} · ${outcomeLabel(kind, row.outcome)}${fields}`;
}

/** "N more in the report" under a capped list, or null when every row is shown. */
export function moreRowsText(total: number): string | null {
  const hidden = total - IMPORT_ROWS_SHOWN;
  return hidden > 0 ? `${hidden} more in the downloaded report.` : null;
}

interface ReportLine {
  readonly line: number;
  readonly slug: string;
  readonly name: string;
  readonly outcome: HotelImportRowOutcome;
  readonly changedFields: string;
  readonly errors: string;
}

function errorsText(errors: HotelImportRowError["errors"]): string {
  return errors.map((e) => `${e.field}: ${e.message}`).join("; ");
}

function reportLines(result: HotelImportResult): ReportLine[] {
  const errorsByLine = new Map(result.rejected.map((row) => [row.line, row.errors]));
  const lines: ReportLine[] = result.rows.map((row) => ({
    line: row.line,
    slug: row.slug ?? "",
    name: row.name ?? "",
    outcome: row.outcome,
    changedFields: row.changedFields.join(", "),
    errors: errorsText(errorsByLine.get(row.line) ?? []),
  }));
  // A rejected row the report does not list still belongs in the file.
  for (const row of result.rejected) {
    if (lines.some((line) => line.line === row.line)) continue;
    const errors = errorsText(row.errors);
    lines.push({ line: row.line, slug: "", name: "", outcome: "error", changedFields: "", errors });
  }
  return lines.sort((a, b) => a.line - b.line);
}

/**
 * The per-row report of a result as CSV: each row's line, web address (the hotel's, as `hotelSlug` for
 * rooms and venues, with the room's or venue's name), outcome, the columns it changes and its errors,
 * so staff can fix the rejected rows in their spreadsheet. Cells are formula-guarded.
 *
 * @example
 * importReportCsv(result); // "line,slug,outcome,changedFields,errors\r\n3,synthetic-lake-hotel,update,city,"
 */
export function importReportCsv(result: HotelImportResult): string {
  const named = namesRows(result.kind);
  const header = named
    ? ["line", "hotelSlug", "name", "outcome", "changedFields", "errors"]
    : ["line", "slug", "outcome", "changedFields", "errors"];
  const body = reportLines(result).map((line) => [
    String(line.line),
    line.slug,
    ...(named ? [line.name] : []),
    line.outcome,
    line.changedFields,
    line.errors,
  ]);
  return csvText([header, ...body]);
}
