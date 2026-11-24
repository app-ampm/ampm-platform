import { Injectable } from "@nestjs/common";
import type { HotelImportRow } from "@ampm/core";

import type { Prisma } from "../../generated/prisma/client.js";
import { type Principal } from "../../policy/principal.types.js";
import { ConfigService } from "../admin/config/config.service.js";
import { MediaService } from "../media/media.service.js";
import { importGrantsOf, type ImportGrants } from "./hotel-audience.js";
import { auditImageOf, type HotelAuditImage } from "./hotel-import.audit.js";
import type { ImportRow } from "./hotel-import.file.js";
import { HotelRowsWriter, newDestinationCount } from "./hotel-import.hotels-write.js";
import {
  CHANGED_ERROR,
  changedSincePreview,
  type PlanMatch,
  type StoredRow,
} from "./hotel-import.job.js";
import {
  HOTELS_IMPORT,
  type AppliedRows,
  type ImportImageRef,
  type ImportJobRef,
  type KindImporter,
  type PlannedRows,
} from "./hotel-import.kinds.js";
import {
  importSlug,
  planImport,
  type ImportContext,
  type ImportDestination,
  type ImportTarget,
  type RowPlan,
} from "./hotel-import.plan.js";
import { refusedReport, type RowReport } from "./hotel-import.report.js";
import { HotelImportRepository, type ImportTargetRow } from "./hotel-import.repository.js";
import { hotelVersion, type HotelVersionScope } from "./hotel-import.version.js";
import { toHotelStaffView } from "./hotels-admin.view.js";

/*
 * The Hotels import (TW-25; AC-35.1; D-181): plans each row against what is stored (hotel-import.plan.ts):
 * create, update the filled cells that differ, leave unchanged, or refuse with a reason held to the
 * uploader's own keys (hotel-audience.ts `importGrantsOf`). A preview stores each planned row with the
 * version token of the hotel it names. An import locks those hotels, re-plans its preview's rows, refuses a
 * row whose hotel changed since (or now exists, for a row that created one), writes the rest with an audit
 * event each (and each destination it creates), and registers the rows' images after the commit.
 */

/** What the plan reads beside the rows, each named hotel's audit image, and each live one's version. */
interface HotelLookup {
  readonly context: ImportContext;
  readonly images: ReadonlyMap<string, HotelAuditImage>;
  readonly versions: ReadonlyMap<string, string>;
}

const unique = (values: readonly string[]): string[] => [...new Set(values)];

@Injectable()
export class HotelRowsImporter implements KindImporter<HotelImportRow> {
  readonly spec = HOTELS_IMPORT;

  constructor(
    private readonly imports: HotelImportRepository,
    private readonly writer: HotelRowsWriter,
    private readonly media: MediaService,
    private readonly config: ConfigService,
  ) {}

  async plan(
    rows: readonly ImportRow<HotelImportRow>[],
    principal: Principal,
  ): Promise<PlannedRows> {
    const lookup = await this.lookUp(rows, principal);
    const plans = planImport(rows, lookup.context);
    const stored = plans.flatMap((plan, index) => {
      const row = rows[index];
      if (plan.outcome === "error" || row === undefined) return [];
      const hotelId = plan.outcome === "create" ? null : plan.hotelId;
      const target =
        hotelId === null ? null : { id: hotelId, version: lookup.versions.get(hotelId) ?? "" };
      return [{ line: row.line, row: this.spec.toJson(row.row), target }];
    });
    const newDestinations = newDestinationCount(plans, lookup.context.destinations);
    const newImages = await this.newImageCount(plans);
    return { reports: plans.map(reportOf), stored, newDestinations, newImages };
  }

  async apply(
    stored: readonly StoredRow<HotelImportRow>[],
    principal: Principal,
    job: ImportJobRef,
    tx: Prisma.TransactionClient,
  ): Promise<AppliedRows> {
    const rows = stored.map(({ line, row }) => ({ line, row }));
    const slugs = unique(rows.map(({ row }) => importSlug(row)).filter((slug) => slug !== ""));
    await this.imports.lockHotelsBySlug(slugs, tx);
    const lookup = await this.lookUp(rows, principal, tx);
    const plans = planImport(rows, lookup.context).map((plan, index) =>
      recheck(plan, stored[index]?.target ?? null, lookup.versions),
    );
    const imageRefs: ImportImageRef[] = [];
    const destinations = liveDestinationIds(lookup.context);
    for (const plan of plans) {
      const hotelId = await this.writer.writeRow(
        plan,
        destinations,
        { ...job, images: lookup.images },
        tx,
      );
      const ref = plan.outcome === "error" ? undefined : plan.row.imageRef;
      if (hotelId !== null && ref) imageRefs.push({ hotelId, ref });
    }
    const newDestinations = newDestinationCount(plans, lookup.context.destinations);
    return { reports: plans.map(reportOf), newDestinations, imageRefs };
  }

  /**
   * Registers each row's by-reference image through Module N, AFTER the hotel transaction has committed
   * (feature 9.3 slice 5b), so a rolled-back import never leaves a pending asset pointing at a hotel that
   * was not written (the C->N boundary, api.md). Idempotent per (hotel, ref), so importing the same file
   * again registers none again; returns how many pending placeholders were newly created.
   */
  async afterCommit(applied: AppliedRows, actorId: string): Promise<number> {
    let registered = 0;
    for (const { hotelId, ref } of applied.imageRefs) {
      const { created } = await this.media.registerImportedImage("hotel", hotelId, ref, actorId);
      if (created) registered++;
    }
    return registered;
  }

  /**
   * How many images importing the planned rows would register, as `afterCommit` would: each new hotel's,
   * and each existing hotel's (hotel, ref) pair Module N does not hold yet. A refused row registers none.
   */
  private async newImageCount(plans: readonly RowPlan[]): Promise<number> {
    let forNewHotels = 0;
    const existing: ImportImageRef[] = [];
    for (const plan of plans) {
      if (plan.outcome === "error" || !plan.row.imageRef) continue;
      if (plan.outcome === "create") forNewHotels++;
      else existing.push({ hotelId: plan.hotelId, ref: plan.row.imageRef });
    }
    const refs = existing.map(({ hotelId, ref }) => ({ ownerId: hotelId, ref }));
    return forNewHotels + (await this.media.countUnregisteredImports("hotel", refs));
  }

  /**
   * What the plan reads beside the rows (the hotels and destinations they name, deleted ones included,
   * each hotel as its uploader may read it), the named hotels' audit images, and each live hotel's
   * version token, never shown to them: it covers the internal rating and notes only for an uploader who
   * reads them or a row that fills them (`notesScopes`), so a notes edit refuses no other row and tells
   * no one who cannot read the notes that they changed (hotel-import.version.ts).
   */
  private async lookUp(
    rows: readonly ImportRow<HotelImportRow>[],
    principal: Principal,
    tx?: Prisma.TransactionClient,
  ): Promise<HotelLookup> {
    const grants = importGrantsOf(principal);
    const { options } = await this.config.get("hotel.cuisine_options");
    const slugs = unique(rows.map(({ row }) => importSlug(row)).filter((slug) => slug !== ""));
    const hotels = await this.imports.findHotelsBySlugs(slugs, tx);
    const destinationSlugs = unique(rows.map(({ row }) => row.destinationSlug));
    const destinations = await this.imports.findDestinationsBySlugs(destinationSlugs, tx);
    const context: ImportContext = {
      cuisineOptions: options,
      canUpdate: grants.canUpdate,
      canWriteNotes: grants.canWriteNotes,
      canCreateDestinations: grants.canCreateDestinations,
      canAddMedia: grants.canAddMedia,
      hotels: new Map(hotels.map((hotel) => [hotel.slug, toImportTarget(hotel, grants)])),
      destinations: new Map(destinations.map(({ slug, ...destination }) => [slug, destination])),
    };
    const live = hotels.filter((hotel) => hotel.deletedAt === null);
    const scopeOf = notesScopes(rows, grants);
    return {
      context,
      images: new Map(hotels.map((hotel) => [hotel.id, auditImageOf(hotel)])),
      versions: new Map(live.map((hotel) => [hotel.id, hotelVersion(hotel, scopeOf(hotel.slug))])),
    };
  }
}

/**
 * What each named hotel's version token covers: the internal rating and notes when the uploader reads
 * them, or when the row planned against the hotel fills either, since only such a row can write over
 * them (D-171). That row is the first to use the hotel's web address: `planImport` refuses a later one,
 * which is never stored, so a preview and its import key the token on the same row.
 */
function notesScopes(
  rows: readonly ImportRow<HotelImportRow>[],
  grants: Pick<ImportGrants, "readsNotes">,
): (slug: string) => HotelVersionScope {
  const fillsNotes = new Map<string, boolean>();
  for (const { row } of rows) {
    const slug = importSlug(row);
    if (fillsNotes.has(slug)) continue;
    fillsNotes.set(slug, row.internalRating !== undefined || row.internalNotes !== undefined);
  }
  return (slug) => ({ notes: grants.readsNotes || fillsNotes.get(slug) === true });
}

/**
 * A stored hotel as the plan reads it: only what the uploader reads (where it is filed and the profile
 * the staff views carry, for a profile reader; the internal rating and notes, for a notes reader), so a
 * preview's outcome never tells them where it is filed or whether a guess matches a value they cannot read.
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
    ([, destination]: [string, ImportDestination]) => destination.deletedAt === null,
  );
  return new Map(live.map(([slug, destination]) => [slug, destination.id]));
}

/**
 * What a hotels re-plan matched: the hotel its web address names, none (a create), or, for a refused row,
 * nothing to compare, so it keeps its own reason unless its hotel changed (a deleted one included).
 */
function matchOf(plan: RowPlan): PlanMatch {
  if (plan.outcome === "error") return { matches: "unmatched" };
  if (plan.outcome === "create") return { matches: "none" };
  return { matches: "row", targetId: plan.hotelId };
}

/** A re-planned row, refused when its hotel changed since the preview (or now exists, for a create). */
function recheck(
  plan: RowPlan,
  target: StoredRow<unknown>["target"],
  versions: ReadonlyMap<string, string>,
): RowPlan {
  if (!changedSincePreview(target, matchOf(plan), (id) => versions.get(id) ?? null)) return plan;
  const name = plan.outcome === "error" ? plan.name : plan.row.name;
  return { outcome: "error", line: plan.line, slug: plan.slug, name, errors: [CHANGED_ERROR] };
}

/** One plan as the report shows it. */
function reportOf(plan: RowPlan): RowReport {
  if (plan.outcome === "error") return refusedReport(plan, plan.errors);
  const changedFields = plan.outcome === "unchanged" ? [] : plan.changedFields;
  return {
    line: plan.line,
    slug: plan.slug,
    name: plan.row.name,
    outcome: plan.outcome,
    changedFields,
    errors: [],
  };
}
