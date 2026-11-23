import type { HotelImportResult, HotelImportRowError, HotelImportRowReport } from "@ampm/core";

import type { Prisma } from "../../generated/prisma/client.js";
import type { ImportFile } from "./hotel-import.file.js";
import type { ImportDestination, RowPlan } from "./hotel-import.plan.js";

/*
 * The import's report (AC-35.1; D-181): every row's outcome and the names of the fields it changes (never
 * their values, so no internal value reaches the report or the job's stored copy), the refused rows by
 * line and field, and the counts. A dry run's counts say what applying the same file would do.
 */

/** The counts, refusals and per-row outcomes of one file's plan. */
export interface ImportSummary {
  readonly totalRows: number;
  readonly created: number;
  readonly updated: number;
  readonly unchanged: number;
  /** Rows that apply (created, updated or unchanged): with none, the job failed. */
  readonly valid: number;
  /** The destinations the file names that do not exist yet, which applying it creates. */
  readonly newDestinations: number;
  readonly rejected: HotelImportRowError[];
  readonly rows: HotelImportRowReport[];
}

const byLine = (a: { readonly line: number }, b: { readonly line: number }): number =>
  a.line - b.line;

/**
 * The summary of a file and its plan.
 *
 * @example
 * const summary = summarise(file, plans, context.destinations);
 */
export function summarise(
  file: ImportFile,
  plans: readonly RowPlan[],
  destinations: ReadonlyMap<string, ImportDestination>,
): ImportSummary {
  const count = (outcome: RowPlan["outcome"]) =>
    plans.filter((plan) => plan.outcome === outcome).length;
  const created = count("create");
  const updated = count("update");
  const unchanged = count("unchanged");
  const refused = [
    ...file.rejected,
    ...plans.flatMap((plan) => (plan.outcome === "error" ? [plan] : [])),
  ];
  return {
    totalRows: file.totalRows,
    created,
    updated,
    unchanged,
    valid: created + updated + unchanged,
    newDestinations: newDestinationSlugs(plans, destinations).size,
    rejected: refused.map(({ line, errors }) => ({ line, errors: [...errors] })).sort(byLine),
    rows: [...file.rejected.map(reportOfRejected), ...plans.map(reportOf)].sort(byLine),
  };
}

/** The destinations the plan's writing rows name that do not exist yet. */
export function newDestinationSlugs(
  plans: readonly RowPlan[],
  destinations: ReadonlyMap<string, ImportDestination>,
): ReadonlySet<string> {
  const slugs = plans.flatMap((plan) =>
    plan.outcome === "create" || (plan.outcome === "update" && plan.movesDestination)
      ? [plan.row.destinationSlug]
      : [],
  );
  return new Set(slugs.filter((slug) => !destinations.has(slug)));
}

function reportOfRejected(row: ImportFile["rejected"][number]): HotelImportRowReport {
  return { line: row.line, slug: row.slug, outcome: "error", changedFields: [] };
}

function reportOf(plan: RowPlan): HotelImportRowReport {
  const changedFields =
    plan.outcome === "create" || plan.outcome === "update" ? [...plan.changedFields] : [];
  return { line: plan.line, slug: plan.slug, outcome: plan.outcome, changedFields };
}

/**
 * What the job keeps in `import_jobs.error_report_json`: the counts, the refusals and every row's outcome,
 * so the report can be read again later.
 *
 * @example
 * await imports.finishImportJob(jobId, { status, rowCount, errorReportJson: reportJson(summary, true) }, actorId);
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
 * The response; `applied` is whether a real run wrote anything (core `hotelImportResult`), and a dry
 * run's `destinationsCreated` is how many destinations applying the file would create.
 *
 * @example
 * return importResult(importJobId, summary, { dryRun: true, mediaRegistered: 0 });
 */
export function importResult(
  importJobId: string,
  summary: ImportSummary,
  outcome: { readonly dryRun: boolean; readonly mediaRegistered: number },
): HotelImportResult {
  const wrote = summary.created + summary.updated + outcome.mediaRegistered > 0;
  return {
    importJobId,
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
