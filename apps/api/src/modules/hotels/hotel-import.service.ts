import { Injectable } from "@nestjs/common";
import { errors, type HotelImportResult, type HotelImportRow } from "@ampm/core";

import { Prisma } from "../../generated/prisma/client.js";
import { AuditService } from "../../policy/audit.service.js";
import { type Principal, staffId } from "../../policy/principal.types.js";
import { ConfigService } from "../admin/config/config.service.js";
import { MediaService } from "../media/media.service.js";
import { importGrantsOf, type ImportGrants } from "./hotel-audience.js";
import { auditImageOf, importAuditImages, type HotelAuditImage } from "./hotel-import.audit.js";
import { readHotelImportFile, type ImportFile, type ImportRow } from "./hotel-import.file.js";
import { titleCaseSlug } from "./hotel-import.js";
import {
  importSlug,
  planImport,
  type ImportContext,
  type ImportTarget,
  type RowPlan,
} from "./hotel-import.plan.js";
import { importResult, reportJson, summarise, type ImportSummary } from "./hotel-import.report.js";
import { HotelImportRepository, type ImportTargetRow } from "./hotel-import.repository.js";
import { NEW_DESTINATION_COUNTRY } from "./hotel-profile-rules.js";
import { toHotelWriteData, toImportPatch } from "./hotel-write.js";
import { HotelsAdminRepository } from "./hotels-admin.repository.js";
import { toHotelStaffView } from "./hotels-admin.view.js";

/** How long one apply may hold its transaction: Prisma's default 5 s is too short for a 2,000-row file. */
const APPLY_TIMEOUT_MS = 30_000;
const APPLY_MAX_WAIT_MS = 5_000;

interface RowImageRef {
  readonly hotelId: string;
  readonly ref: string;
}

/** The uploader's side of the plan: the configured cuisines and what their grants let them do and read. */
interface ImportSettings {
  readonly cuisineOptions: readonly string[];
  readonly grants: ImportGrants;
}

/** The job a write belongs to, who is writing, and the audit images of the hotels the file names. */
interface ImportJob {
  readonly importJobId: string;
  readonly actorId: string;
  readonly images: ReadonlyMap<string, HotelAuditImage>;
}

/** What the plan reads beside the rows, and each named hotel's audit image by its id. */
interface ImportLookup {
  readonly context: ImportContext;
  readonly images: ReadonlyMap<string, HotelAuditImage>;
}

/** What one apply did inside its transaction. */
interface Applied {
  readonly importJobId: string;
  readonly summary: ImportSummary;
  readonly imageRefs: RowImageRef[];
}

/**
 * The hotel spreadsheet import (TW-25; AC-35.1; D-181). Reads the uploaded CSV, checks every row against
 * the template, then plans each row against what is stored (hotel-import.plan.ts): create, update the
 * filled cells that differ, leave unchanged, or refuse with a reason. A dry run stops there: it writes
 * only an `import_jobs` row (status `validating`) holding the full report, and its counts say what
 * applying would do. An apply re-plans inside one transaction, writes only the create and update rows,
 * each with an audit event naming the fields it changed (and each destination it creates, audited too),
 * and records the job: `applied` when any row was valid, even if all were unchanged, `failed` when none
 * was. The result's `applied` says whether the run wrote anything. The refused rows never stop the valid
 * ones. Each row is held to the uploader's own keys (hotel-audience.ts `importGrantsOf`).
 */
@Injectable()
export class HotelImportService {
  constructor(
    private readonly hotels: HotelsAdminRepository,
    private readonly imports: HotelImportRepository,
    private readonly audit: AuditService,
    private readonly media: MediaService,
    private readonly config: ConfigService,
  ) {}

  async import(
    bytes: Uint8Array,
    options: { readonly dryRun: boolean },
    principal: Principal,
  ): Promise<HotelImportResult> {
    const file = readHotelImportFile(bytes);
    const actorId = staffId(principal);
    const settings = await this.settingsFor(principal);
    if (options.dryRun) return this.preview(file, settings, actorId);
    const applied = await this.apply(file, settings, actorId);
    // Media is registered through Module N AFTER the hotel transaction commits, so a rolled-back import
    // never leaves a pending asset pointing at a hotel that was not written (the C->N boundary, api.md).
    const mediaRegistered = await this.registerMedia(applied.imageRefs, actorId);
    return importResult(applied.importJobId, applied.summary, { dryRun: false, mediaRegistered });
  }

  /** The dry run: the plan and its report, kept on a `validating` job; no hotel is touched. */
  private async preview(
    file: ImportFile,
    settings: ImportSettings,
    actorId: string,
  ): Promise<HotelImportResult> {
    const { context } = await this.lookUp(file.rows, settings);
    const summary = summarise(file, planImport(file.rows, context), context.destinations);
    const importJobId = await this.imports.createImportJob("hotels", actorId);
    await this.imports.finishImportJob(
      importJobId,
      {
        status: "validating",
        rowCount: file.totalRows,
        errorReportJson: reportJson(summary, true),
      },
      actorId,
    );
    return importResult(importJobId, summary, { dryRun: true, mediaRegistered: 0 });
  }

  /** The apply, all-or-nothing; a web address taken meanwhile by another write answers 409. */
  private async apply(
    file: ImportFile,
    settings: ImportSettings,
    actorId: string,
  ): Promise<Applied> {
    try {
      return await this.hotels.transaction((tx) => this.applyIn(file, settings, actorId, tx), {
        timeout: APPLY_TIMEOUT_MS,
        maxWait: APPLY_MAX_WAIT_MS,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw errors.conflict(
          "Another change took one of these web addresses while the import ran; run it again",
        );
      }
      throw error;
    }
  }

  private async applyIn(
    file: ImportFile,
    settings: ImportSettings,
    actorId: string,
    tx: Prisma.TransactionClient,
  ): Promise<Applied> {
    const importJobId = await this.imports.createImportJob("hotels", actorId, tx);
    const { context, images } = await this.lookUp(file.rows, settings, tx);
    const plans = planImport(file.rows, context);
    const destinationIds = liveDestinationIds(context);
    const imageRefs: RowImageRef[] = [];
    for (const plan of plans) {
      const hotelId = await this.writeRow(
        plan,
        destinationIds,
        { importJobId, actorId, images },
        tx,
      );
      const ref = plan.outcome === "error" ? undefined : plan.row.imageRef;
      if (hotelId !== null && ref) imageRefs.push({ hotelId, ref });
    }
    const summary = summarise(file, plans, context.destinations);
    const status = summary.valid > 0 ? "applied" : "failed";
    const errorReportJson = reportJson(summary, false);
    await this.imports.finishImportJob(
      importJobId,
      { status, rowCount: file.totalRows, errorReportJson },
      actorId,
      tx,
    );
    return { importJobId, summary, imageRefs };
  }

  /** Writes one row's plan with its audit event; returns the row's hotel, or null for a refused row. */
  private async writeRow(
    plan: RowPlan,
    destinationIds: Map<string, string>,
    job: ImportJob,
    tx: Prisma.TransactionClient,
  ): Promise<string | null> {
    if (plan.outcome === "error") return null;
    if (plan.outcome === "unchanged") return plan.hotelId;
    if (plan.outcome === "create") {
      const destinationId = await this.destinationFor(plan.row, destinationIds, job, tx);
      const data = toHotelWriteData(plan.row, destinationId, plan.slug);
      const hotelId = await this.hotels.createHotel(data, job.actorId, tx);
      await this.auditRow(hotelId, plan, job, tx);
      return hotelId;
    }
    const patch = toImportPatch(plan.row, new Set(plan.changed));
    if (plan.movesDestination) {
      patch.destinationId = await this.destinationFor(plan.row, destinationIds, job, tx);
    }
    await this.hotels.updateHotel(plan.hotelId, patch, job.actorId, tx);
    await this.auditRow(plan.hotelId, plan, job, tx);
    return plan.hotelId;
  }

  /**
   * The row's destination, created (active, unlisted, in India) the first time the file names it, with
   * the audit event `POST /hotels-admin/destinations` would record. The plan has refused such a row for
   * an uploader without the destinations key.
   */
  private async destinationFor(
    row: HotelImportRow,
    ids: Map<string, string>,
    job: ImportJob,
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const known = ids.get(row.destinationSlug);
    if (known) return known;
    const id = await this.hotels.createDestination(
      {
        name: row.destinationName ?? titleCaseSlug(row.destinationSlug),
        slug: row.destinationSlug,
        region: null,
        state: null,
        country: NEW_DESTINATION_COUNTRY,
        description: null,
        status: "active",
        publicVisible: false,
      },
      job.actorId,
      tx,
    );
    const after = { slug: row.destinationSlug, source: "import", importJobId: job.importJobId };
    await this.audit.record(
      {
        action: "create",
        entityType: "destination",
        entityId: id,
        before: null,
        after,
        maskImages: false,
      },
      tx,
    );
    ids.set(row.destinationSlug, id);
    return id;
  }

  /**
   * The audit event of one applied row: the hotel's name, status and flags before and after, and the
   * other fields it changed by name, never their values (hotel-import.audit.ts).
   */
  private auditRow(
    entityId: string,
    plan: Extract<RowPlan, { outcome: "create" | "update" }>,
    job: ImportJob,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const stored = plan.outcome === "update" ? (job.images.get(plan.hotelId) ?? null) : null;
    const { before, after } = importAuditImages(plan, stored, job.importJobId);
    return this.audit.record(
      { action: plan.outcome, entityType: "hotel", entityId, before, after, maskImages: false },
      tx,
    );
  }

  /**
   * What the plan reads beside the rows (the hotels and destinations they name, deleted ones included,
   * each hotel as its uploader may read it) and the named hotels' audit images.
   */
  private async lookUp(
    rows: readonly ImportRow[],
    settings: ImportSettings,
    tx?: Prisma.TransactionClient,
  ): Promise<ImportLookup> {
    const slugs = unique(rows.map(({ row }) => importSlug(row)).filter((slug) => slug !== ""));
    const hotels = await this.imports.findHotelsBySlugs(slugs, tx);
    const destinationSlugs = unique(rows.map(({ row }) => row.destinationSlug));
    const destinations = await this.imports.findDestinationsBySlugs(destinationSlugs, tx);
    const { grants } = settings;
    const context: ImportContext = {
      cuisineOptions: settings.cuisineOptions,
      canUpdate: grants.canUpdate,
      canWriteNotes: grants.canWriteNotes,
      canCreateDestinations: grants.canCreateDestinations,
      canAddMedia: grants.canAddMedia,
      hotels: new Map(hotels.map((hotel) => [hotel.slug, toImportTarget(hotel, grants)])),
      destinations: new Map(destinations.map(({ slug, ...destination }) => [slug, destination])),
    };
    return { context, images: new Map(hotels.map((hotel) => [hotel.id, auditImageOf(hotel)])) };
  }

  private async settingsFor(principal: Principal): Promise<ImportSettings> {
    const { options } = await this.config.get("hotel.cuisine_options");
    return { cuisineOptions: options, grants: importGrantsOf(principal) };
  }

  /**
   * Register each row's by-reference image through Module N, AFTER the hotel transaction has committed
   * (feature 9.3 slice 5b). Idempotent per (hotel, ref), so a re-run of the same file registers none again;
   * returns how many pending placeholders were newly created.
   */
  private async registerMedia(imageRefs: RowImageRef[], actorId: string): Promise<number> {
    let mediaRegistered = 0;
    for (const { hotelId, ref } of imageRefs) {
      const { created } = await this.media.registerImportedImage("hotel", hotelId, ref, actorId);
      if (created) mediaRegistered++;
    }
    return mediaRegistered;
  }
}

const unique = (values: readonly string[]): string[] => [...new Set(values)];

/**
 * A stored hotel as the plan reads it: only what the uploader reads (where it is filed and the profile
 * the staff views carry, for a profile reader; the internal rating and notes, for a notes reader), so a
 * dry run's outcome never tells them where it is filed or whether a guess matches a value they cannot read.
 */
function toImportTarget(
  row: ImportTargetRow,
  reads: Pick<ImportGrants, "readsProfiles" | "readsNotes">,
): ImportTarget {
  const notes = { internalRating: row.internalRating, internalNotes: row.internalNotes };
  const filing = { destinationSlug: row.destination.slug, postalCode: row.postalCode };
  return {
    id: row.id,
    deletedAt: row.deletedAt,
    filing: reads.readsProfiles ? filing : null,
    values: {
      ...(reads.readsProfiles ? toHotelStaffView(row) : {}),
      ...(reads.readsNotes ? notes : {}),
    },
  };
}

/** The ids of the named destinations that are not deleted (a deleted one's rows were refused). */
function liveDestinationIds(context: ImportContext): Map<string, string> {
  const live = [...context.destinations].filter(
    ([, destination]) => destination.deletedAt === null,
  );
  return new Map(live.map(([slug, destination]) => [slug, destination.id]));
}
