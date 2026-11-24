import type {
  HotelImportChangedField,
  HotelImportKind,
  HotelImportResult,
  HotelImportRowError,
  HotelImportRowItem,
  HotelImportRowOutcome,
  HotelImportRowReport,
} from "@ampm/core";

import type { Prisma } from "../../generated/prisma/client.js";
import type { RejectedRow } from "./hotel-import.file.js";
import type { FieldError } from "./hotel-import.plan.js";

/*
 * The import's report (AC-35.1; D-181, D-183, D-184), the same for every kind: every row's outcome, the
 * hotel, room, venue or rate card it reads (a rates row, its item too) and the names of the fields it
 * changes (never their values, so no internal value reaches the report or the job's stored copy), the
 * refused rows by line and field, and the counts. A preview's counts say what importing it would do; an
 * import's say what it did.
 */

/** One planned row as every kind reports it: what it names, its outcome, and what it changes or why not. */
export interface RowReport {
  readonly line: number;
  /** The hotel's web address. */
  readonly slug: string | null;
  /** The hotel's, room's, venue's or rate card's name. */
  readonly name: string | null;
  /** A rates row's item: its type, and the room or venue it is for. */
  readonly item?: HotelImportRowItem;
  readonly outcome: HotelImportRowOutcome;
  readonly changedFields: readonly HotelImportChangedField[];
  readonly errors: readonly FieldError[];
}

/** The counts, refusals and per-row outcomes of one file's plan. */
export interface ImportSummary {
  readonly totalRows: number;
  readonly created: number;
  readonly updated: number;
  readonly unchanged: number;
  /** Rows that apply (created, updated or unchanged): with none, a preview has nothing to import. */
  readonly valid: number;
  /** The destinations a hotels file names that do not exist yet, which importing it creates. */
  readonly newDestinations: number;
  readonly rejected: HotelImportRowError[];
  readonly rows: HotelImportRowReport[];
}

/** What a summary is made of: the file's size, the rows refused before planning, and each plan. */
export interface SummaryInput {
  readonly totalRows: number;
  readonly refused: readonly RejectedRow[];
  readonly reports: readonly RowReport[];
  readonly newDestinations: number;
}

const byLine = (a: { readonly line: number }, b: { readonly line: number }): number =>
  a.line - b.line;

/**
 * A refused row's report.
 *
 * @example
 * refusedReport({ line: 3, slug: "synthetic-bay", name: null }, [{ field: "row", message: "Changed since preview; validate the file again" }]);
 */
export function refusedReport(
  row: {
    readonly line: number;
    readonly slug: string | null;
    readonly name: string | null;
    readonly item?: HotelImportRowItem;
  },
  errors: readonly FieldError[],
): RowReport {
  return { ...row, outcome: "error", changedFields: [], errors };
}

/**
 * The summary of a file and its plan.
 *
 * @example
 * const summary = summarise({ totalRows: file.totalRows, refused: file.rejected, reports, newDestinations: 0 });
 */
export function summarise(input: SummaryInput): ImportSummary {
  const count = (outcome: HotelImportRowOutcome) =>
    input.reports.filter((report) => report.outcome === outcome).length;
  const created = count("create");
  const updated = count("update");
  const unchanged = count("unchanged");
  const refused = [
    ...input.refused,
    ...input.reports.filter((report) => report.outcome === "error"),
  ];
  return {
    totalRows: input.totalRows,
    created,
    updated,
    unchanged,
    valid: created + updated + unchanged,
    newDestinations: input.newDestinations,
    rejected: refused.map(({ line, errors }) => ({ line, errors: [...errors] })).sort(byLine),
    rows: [...input.refused.map((row) => refusedReport(row, row.errors)), ...input.reports]
      .map(rowReportOf)
      .sort(byLine),
  };
}

function rowReportOf(report: RowReport): HotelImportRowReport {
  return {
    line: report.line,
    slug: report.slug,
    name: report.name,
    outcome: report.outcome,
    changedFields: [...report.changedFields],
    ...(report.item === undefined ? {} : { item: { ...report.item } }),
  };
}

/**
 * What the job keeps in `import_jobs.error_report_json`: the counts, the refusals and every row's outcome,
 * so the report can be read again later. Never a value.
 *
 * @example
 * await jobs.recordPreview(importType, actorId, { status, rowCount, errorReportJson: reportJson(summary, true), planJson });
 */
export function reportJson(summary: ImportSummary, dryRun: boolean): Prisma.InputJsonValue {
  return {
    dryRun,
    totalRows: summary.totalRows,
    created: summary.created,
    updated: summary.updated,
    unchanged: summary.unchanged,
    destinationsCreated: summary.newDestinations,
    rejected: summary.rejected,
    rows: summary.rows,
  };
}

/**
 * The response; `applied` is whether an import wrote anything (core `hotelImportResult`), and a preview's
 * `destinationsCreated` and `mediaRegistered` are how many destinations and images importing it would add.
 *
 * @example
 * return importResult(importJobId, "rooms", summary, { dryRun: true, mediaRegistered: 0 });
 */
export function importResult(
  importJobId: string,
  kind: HotelImportKind,
  summary: ImportSummary,
  outcome: { readonly dryRun: boolean; readonly mediaRegistered: number },
): HotelImportResult {
  const wrote = summary.created + summary.updated + outcome.mediaRegistered > 0;
  return {
    importJobId,
    kind,
    dryRun: outcome.dryRun,
    applied: !outcome.dryRun && wrote,
    totalRows: summary.totalRows,
    created: summary.created,
    updated: summary.updated,
    unchanged: summary.unchanged,
    destinationsCreated: summary.newDestinations,
    mediaRegistered: outcome.mediaRegistered,
    rejected: summary.rejected,
    rows: summary.rows,
  };
}
