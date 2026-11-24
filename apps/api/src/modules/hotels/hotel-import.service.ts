import { Injectable } from "@nestjs/common";
import {
  errors,
  type HotelImportKind,
  type HotelImportResult,
  type RoomImportRow,
  type VenueImportRow,
} from "@ampm/core";

import { Prisma } from "../../generated/prisma/client.js";
import { type Principal, staffId } from "../../policy/principal.types.js";
import { ROOM_KIND, VENUE_KIND } from "./hotel-import.child-kinds.js";
import { ChildRowsImporter } from "./hotel-import.children.js";
import { readImportFile, type RejectedRow } from "./hotel-import.file.js";
import { HotelRowsImporter } from "./hotel-import.hotels.js";
import {
  previewRefusal,
  readStoredPlan,
  refusalError,
  storedPlanJson,
  type PreviewRefusal,
} from "./hotel-import.job.js";
import type { AppliedRows, KindImporter, PlannedRows } from "./hotel-import.kinds.js";
import { RatesImporter } from "./hotel-import.rates.js";
import { importResult, reportJson, summarise, type ImportSummary } from "./hotel-import.report.js";
import { HotelImportRepository } from "./hotel-import.repository.js";

/** How long one import may hold its transaction: Prisma's default 5 s is too short for a 2,000-row file. */
const APPLY_TIMEOUT_MS = 30_000;
const APPLY_MAX_WAIT_MS = 5_000;

/** What an import's transaction did: its rows' outcomes and the summary its job keeps. */
interface Imported {
  readonly applied: AppliedRows;
  readonly summary: ImportSummary;
}

/** Why an import's transaction imported nothing: the caller cannot import that preview. */
interface Refused {
  readonly refusal: PreviewRefusal;
}

/**
 * Why an import lost a race for a unique key (a web address taken meanwhile). Its transaction rolled back,
 * so nothing was written; the next step is the one every other refusal here names (and the staff app
 * takes): validate the file again, which plans each row against the hotel or destination now there.
 */
const RACED =
  "Another change took one of these web addresses while the import ran; validate the file again";

/**
 * The staff spreadsheet import (TW-25; AC-35.1; D-181, D-183, D-184), the same two steps for every kind
 * (hotels, rooms, venues, rates). A preview reads the uploaded CSV, checks every row against its
 * template, plans each row against what is stored (create, update the filled cells that differ, leave
 * unchanged, or refuse with a reason), and writes only its `import_jobs` row: status `validating` with
 * the value-free report and the stored plan, or `failed` with no plan when no row is valid; it clears the
 * plans of the uploader's older previews of the kind. An import applies a preview by its job id, with no
 * file: inside one transaction it claims the job (only its uploader, once, within the time limit),
 * re-plans the stored rows against the catalogue under the uploader's current keys, refuses a row whose
 * target changed since the preview, writes the rest with an audit event each, and marks the job
 * `applied`, its plan cleared and the import's report kept. A hotels import registers its rows' images
 * after the commit. The refused rows never stop the valid ones.
 */
@Injectable()
export class HotelImportService {
  private readonly rooms: KindImporter<RoomImportRow>;
  private readonly venues: KindImporter<VenueImportRow>;

  constructor(
    private readonly hotels: HotelRowsImporter,
    children: ChildRowsImporter,
    private readonly rates: RatesImporter,
    private readonly jobs: HotelImportRepository,
  ) {
    this.rooms = children.importerFor(ROOM_KIND);
    this.venues = children.importerFor(VENUE_KIND);
  }

  /** Previews an uploaded file of one kind; nothing but its job is written. */
  preview(
    kind: HotelImportKind,
    bytes: Uint8Array,
    principal: Principal,
  ): Promise<HotelImportResult> {
    switch (kind) {
      case "hotels":
        return this.previewWith(this.hotels, bytes, principal);
      case "rooms":
        return this.previewWith(this.rooms, bytes, principal);
      case "venues":
        return this.previewWith(this.venues, bytes, principal);
      case "rates":
        return this.previewWith(this.rates, bytes, principal);
    }
  }

  /** Imports the caller's preview of one kind by its job id. */
  apply(kind: HotelImportKind, jobId: string, principal: Principal): Promise<HotelImportResult> {
    switch (kind) {
      case "hotels":
        return this.applyWith(this.hotels, jobId, principal);
      case "rooms":
        return this.applyWith(this.rooms, jobId, principal);
      case "venues":
        return this.applyWith(this.venues, jobId, principal);
      case "rates":
        return this.applyWith(this.rates, jobId, principal);
    }
  }

  private async previewWith<Row>(
    importer: KindImporter<Row>,
    bytes: Uint8Array,
    principal: Principal,
  ): Promise<HotelImportResult> {
    const { spec } = importer;
    const file = readImportFile(bytes, spec);
    const actorId = staffId(principal);
    const planned = await importer.plan(file.rows, principal);
    const summary = summarise({ ...planned, totalRows: file.totalRows, refused: file.rejected });
    const importable = summary.valid > 0;
    const planJson = importable
      ? storedPlanJson(spec.kind, {
          totalRows: file.totalRows,
          rows: planned.stored,
          refused: refusedRows(file.rejected, planned),
        })
      : null;
    const importJobId = await this.jobs.recordPreview(spec.importType, actorId, {
      status: importable ? "validating" : "failed",
      rowCount: file.totalRows,
      errorReportJson: reportJson(summary, true),
      planJson,
    });
    await this.jobs.supersedePreviews(spec.importType, actorId, importJobId);
    const mediaRegistered = planned.newImages;
    return importResult(importJobId, spec.kind, summary, { dryRun: true, mediaRegistered });
  }

  private async applyWith<Row>(
    importer: KindImporter<Row>,
    jobId: string,
    principal: Principal,
  ): Promise<HotelImportResult> {
    const actorId = staffId(principal);
    const { applied, summary } = await this.importIn(importer, jobId, principal);
    const mediaRegistered = await importer.afterCommit(applied, actorId);
    return importResult(jobId, importer.spec.kind, summary, { dryRun: false, mediaRegistered });
  }

  /**
   * The import's transaction. A refused preview is answered once the transaction has committed, so the
   * clearing of an expired plan holds; a web address taken meanwhile by another write answers 409.
   */
  private async importIn<Row>(
    importer: KindImporter<Row>,
    jobId: string,
    principal: Principal,
  ): Promise<Imported> {
    let outcome: Imported | Refused;
    try {
      outcome = await this.jobs.transaction(
        (tx) => this.importWithin(importer, jobId, principal, tx),
        { timeout: APPLY_TIMEOUT_MS, maxWait: APPLY_MAX_WAIT_MS },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw errors.conflict(RACED);
      }
      throw error;
    }
    if ("refusal" in outcome) throw refusalError(outcome.refusal);
    return outcome;
  }

  /**
   * Claims the preview, re-plans and writes its rows, and records the job, all in one transaction; or,
   * when the caller cannot import it, says why, first clearing the plan of their preview that can never be
   * imported now (it holds the file's values, internal notes included: RESTRICTED-NOTES). Another
   * person's preview is never touched.
   */
  private async importWithin<Row>(
    importer: KindImporter<Row>,
    jobId: string,
    principal: Principal,
    tx: Prisma.TransactionClient,
  ): Promise<Imported | Refused> {
    const actorId = staffId(principal);
    const { spec } = importer;
    const job = await this.jobs.claimPreview(jobId, tx);
    const refused = previewRefusal(job, { actorId, importType: spec.importType }, new Date());
    const plan = refused === null && job !== null ? readStoredPlan(job.planJson, spec) : null;
    if (plan === null) {
      const refusal = refused ?? "expired";
      if (refusal === "expired" && job !== null && job.planJson !== null) {
        await this.jobs.clearPlan(jobId, actorId, tx);
      }
      return { refusal };
    }
    const applied = await importer.apply(plan.rows, principal, { importJobId: jobId, actorId }, tx);
    const summary = summarise({ ...applied, totalRows: plan.totalRows, refused: plan.refused });
    const errorReportJson = reportJson(summary, false);
    await this.jobs.finishImport(jobId, { rowCount: plan.totalRows, errorReportJson }, actorId, tx);
    return { applied, summary };
  }
}

/** Every row a preview refused, before or after planning: what its import reports again by line. */
function refusedRows(rejected: readonly RejectedRow[], planned: PlannedRows): RejectedRow[] {
  const refusedByPlan = planned.reports.flatMap(
    ({ outcome, line, slug, name, item, errors: rowErrors }) =>
      outcome === "error"
        ? [{ line, slug, name, ...(item === undefined ? {} : { item }), errors: [...rowErrors] }]
        : [],
  );
  return [...rejected, ...refusedByPlan];
}
