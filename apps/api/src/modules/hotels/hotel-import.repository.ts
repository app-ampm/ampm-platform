import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../db/prisma.service.js";
import { Prisma, type ImportType } from "../../generated/prisma/client.js";
import type { PreviewJob } from "./hotel-import.job.js";
import {
  ROOM_SELECT,
  VENUE_SELECT,
  type RoomRow,
  type VenueRow,
} from "./hotel-subresources.repository.js";
import { STAFF_HOTEL_SELECT } from "./hotels-admin.repository.js";

/*
 * The import's own reads, its locks and its job record (TW-25; AC-35.1; D-181, D-183, D-184). The hotel
 * lookups deliberately include soft-deleted rows: a hotel's and a destination's slug stay unique across
 * deleted rows, so a row naming a deleted one must be reported, not inserted into the unique index. A
 * hotel's rooms and venues are read live only: a retired name is created again; so are its rate cards,
 * less the retired ones (whose names are free), each with its live items. The writes themselves go
 * through HotelsAdminRepository, HotelSubresourcesRepository and HotelRatesRepository. An import locks
 * the hotels it names first, then their live rooms, venues, rate cards and rate items, each in id order
 * (so two imports never deadlock), before it re-plans its preview.
 */

/** A hotel a file names: every staff column, its deletion and its destination's slug. */
const IMPORT_TARGET_SELECT = {
  ...STAFF_HOTEL_SELECT,
  deletedAt: true,
  destination: { select: { slug: true } },
} as const satisfies Prisma.HotelSelect;

export type ImportTargetRow = Prisma.HotelGetPayload<{ select: typeof IMPORT_TARGET_SELECT }>;

const IMPORT_DESTINATION_SELECT = {
  id: true,
  slug: true,
  country: true,
  deletedAt: true,
} as const satisfies Prisma.DestinationSelect;

export type ImportDestinationRow = Prisma.DestinationGetPayload<{
  select: typeof IMPORT_DESTINATION_SELECT;
}>;

/** A rate item as the rates import compares and hashes it. */
const IMPORT_RATE_ITEM_SELECT = {
  id: true,
  itemType: true,
  roomCategoryId: true,
  venueId: true,
  amount: true,
  amountMax: true,
  unit: true,
  minQuantity: true,
  isIndicative: true,
  inclusionsText: true,
} as const satisfies Prisma.HotelRateItemSelect;

/** A rate card of a named hotel as the rates import matches it, with its live items. */
const IMPORT_RATE_CARD_SELECT = {
  id: true,
  hotelId: true,
  name: true,
  status: true,
  validFrom: true,
  validTo: true,
  items: { where: { deletedAt: null }, orderBy: { id: "asc" }, select: IMPORT_RATE_ITEM_SELECT },
} as const satisfies Prisma.HotelRateCardSelect;

export type ImportRateCardRow = Prisma.HotelRateCardGetPayload<{
  select: typeof IMPORT_RATE_CARD_SELECT;
}>;
export type ImportRateItemRow = ImportRateCardRow["items"][number];

/** A hotel a rooms, venues or rates file names, deleted ones included. */
export interface ImportHotelRef {
  readonly id: string;
  readonly slug: string;
  readonly deletedAt: Date | null;
}

/** What a preview's job records: its outcome, the value-free report and, while it has one, its plan. */
export interface PreviewOutcome {
  readonly status: "validating" | "failed";
  readonly rowCount: number;
  readonly errorReportJson: Prisma.InputJsonValue;
  readonly planJson: Prisma.InputJsonValue | null;
}

/** What an import records on its preview's job. */
export interface ApplyOutcome {
  readonly rowCount: number;
  readonly errorReportJson: Prisma.InputJsonValue;
}

const PREVIEW_JOB_SELECT = {
  importType: true,
  status: true,
  createdBy: true,
  createdAt: true,
  deletedAt: true,
  planJson: true,
} as const satisfies Prisma.ImportJobSelect;

type Client = Prisma.TransactionClient;

@Injectable()
export class HotelImportRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The hotels with these web addresses, soft-deleted ones INCLUDED (see the file comment). */
  findHotelsBySlugs(slugs: readonly string[], tx?: Client): Promise<ImportTargetRow[]> {
    return (tx ?? this.prisma).hotel.findMany({
      where: { slug: { in: [...slugs] } },
      select: IMPORT_TARGET_SELECT,
    });
  }

  /** The hotels with these web addresses as a rooms or venues row names them, deleted ones INCLUDED. */
  findHotelRefsBySlugs(slugs: readonly string[], tx?: Client): Promise<ImportHotelRef[]> {
    return (tx ?? this.prisma).hotel.findMany({
      where: { slug: { in: [...slugs] } },
      select: { id: true, slug: true, deletedAt: true },
    });
  }

  /** The destinations with these slugs, soft-deleted ones INCLUDED (see the file comment). */
  findDestinationsBySlugs(slugs: readonly string[], tx?: Client): Promise<ImportDestinationRow[]> {
    return (tx ?? this.prisma).destination.findMany({
      where: { slug: { in: [...slugs] } },
      select: IMPORT_DESTINATION_SELECT,
    });
  }

  /** The live room categories of these hotels, as the staff detail reads them. */
  findLiveRooms(hotelIds: readonly string[], tx?: Client): Promise<RoomRow[]> {
    return (tx ?? this.prisma).hotelRoomCategory.findMany({
      where: { hotelId: { in: [...hotelIds] }, deletedAt: null },
      orderBy: { id: "asc" },
      select: ROOM_SELECT,
    });
  }

  /** The live venues of these hotels, as the staff detail reads them. */
  findLiveVenues(hotelIds: readonly string[], tx?: Client): Promise<VenueRow[]> {
    return (tx ?? this.prisma).hotelVenue.findMany({
      where: { hotelId: { in: [...hotelIds] }, deletedAt: null },
      orderBy: { id: "asc" },
      select: VENUE_SELECT,
    });
  }

  /** The live rate cards of these hotels that are not retired, each with its live items. */
  findLiveRateCards(hotelIds: readonly string[], tx?: Client): Promise<ImportRateCardRow[]> {
    return (tx ?? this.prisma).hotelRateCard.findMany({
      where: { hotelId: { in: [...hotelIds] }, deletedAt: null, status: { not: "retired" } },
      orderBy: { id: "asc" },
      select: IMPORT_RATE_CARD_SELECT,
    });
  }

  /** Locks the hotels with these web addresses until the transaction ends, deleted ones included. */
  async lockHotelsBySlug(slugs: readonly string[], tx: Client): Promise<void> {
    if (slugs.length === 0) return;
    await tx.$queryRaw`
      SELECT id FROM hotels WHERE slug = ANY(${[...slugs]}::text[]) ORDER BY id FOR UPDATE`;
  }

  /** Locks these hotels' live room categories until the transaction ends. */
  async lockLiveRooms(hotelIds: readonly string[], tx: Client): Promise<void> {
    if (hotelIds.length === 0) return;
    await tx.$queryRaw`
      SELECT id FROM hotel_room_categories
      WHERE hotel_id = ANY(${[...hotelIds]}::uuid[]) AND deleted_at IS NULL ORDER BY id FOR UPDATE`;
  }

  /** Locks these hotels' live venues until the transaction ends. */
  async lockLiveVenues(hotelIds: readonly string[], tx: Client): Promise<void> {
    if (hotelIds.length === 0) return;
    await tx.$queryRaw`
      SELECT id FROM hotel_venues
      WHERE hotel_id = ANY(${[...hotelIds]}::uuid[]) AND deleted_at IS NULL ORDER BY id FOR UPDATE`;
  }

  /**
   * Holds these hotels' live room categories against a rename or removal until the transaction ends,
   * for an import that only reads them (Rates, D-184). A share lock, not FOR UPDATE: a staff rate-item
   * edit that links a room takes the foreign key's key-share lock on it, which FOR UPDATE would block
   * while that edit holds the item the import locks next (a deadlock).
   */
  async shareLiveRooms(hotelIds: readonly string[], tx: Client): Promise<void> {
    if (hotelIds.length === 0) return;
    await tx.$queryRaw`
      SELECT id FROM hotel_room_categories
      WHERE hotel_id = ANY(${[...hotelIds]}::uuid[]) AND deleted_at IS NULL ORDER BY id FOR SHARE`;
  }

  /** As {@link shareLiveRooms}, for these hotels' live venues. */
  async shareLiveVenues(hotelIds: readonly string[], tx: Client): Promise<void> {
    if (hotelIds.length === 0) return;
    await tx.$queryRaw`
      SELECT id FROM hotel_venues
      WHERE hotel_id = ANY(${[...hotelIds]}::uuid[]) AND deleted_at IS NULL ORDER BY id FOR SHARE`;
  }

  /**
   * Locks these hotels' live rate cards that are not retired until the transaction ends, so none is
   * verified, retired, redated or renamed under an import; answers their ids, whose items are locked next.
   */
  async lockLiveRateCards(hotelIds: readonly string[], tx: Client): Promise<string[]> {
    if (hotelIds.length === 0) return [];
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM hotel_rate_cards
      WHERE hotel_id = ANY(${[...hotelIds]}::uuid[]) AND deleted_at IS NULL AND status <> 'retired'
      ORDER BY id FOR UPDATE`;
    return rows.map(({ id }) => id);
  }

  /** Locks these rate cards' live items until the transaction ends. */
  async lockLiveRateItems(cardIds: readonly string[], tx: Client): Promise<void> {
    if (cardIds.length === 0) return;
    await tx.$queryRaw`
      SELECT id FROM hotel_rate_items
      WHERE rate_card_id = ANY(${[...cardIds]}::uuid[]) AND deleted_at IS NULL ORDER BY id FOR UPDATE`;
  }

  // --- The job ---

  /** Records a preview in one insert; returns its id, the id its import is asked by. */
  async recordPreview(
    importType: ImportType,
    actorId: string,
    outcome: PreviewOutcome,
  ): Promise<string> {
    const row = await this.prisma.importJob.create({
      data: {
        importType,
        status: outcome.status,
        rowCount: outcome.rowCount,
        errorReportJson: outcome.errorReportJson,
        planJson: outcome.planJson ?? Prisma.DbNull,
        createdBy: actorId,
        updatedBy: actorId,
      },
      select: { id: true },
    });
    return row.id;
  }

  /** Clears the plans of the uploader's older previews of this kind: only the newest can be imported. */
  async supersedePreviews(importType: ImportType, actorId: string, keepId: string): Promise<void> {
    await this.prisma.importJob.updateMany({
      where: {
        importType,
        createdBy: actorId,
        status: "validating",
        id: { not: keepId },
        planJson: { not: Prisma.DbNull },
      },
      data: { planJson: Prisma.DbNull, updatedBy: actorId },
    });
  }

  /**
   * The job, locked until the transaction ends: a second import of the same preview waits here, then
   * finds it imported.
   */
  async claimPreview(id: string, tx: Client): Promise<PreviewJob | null> {
    await tx.$queryRaw`SELECT id FROM import_jobs WHERE id = ${id}::uuid FOR UPDATE`;
    return tx.importJob.findUnique({ where: { id }, select: PREVIEW_JOB_SELECT });
  }

  /** Clears the plan of the caller's preview that can no longer be imported (an import found it expired). */
  async clearPlan(id: string, actorId: string, tx: Client): Promise<void> {
    await tx.importJob.update({
      where: { id },
      data: { planJson: Prisma.DbNull, updatedBy: actorId },
    });
  }

  /**
   * Clears the plans of these import types' previews that can no longer be imported: every one created
   * before `cutoff` (the time limit ago), and any still kept on a job that is not validating. The System
   * clears them, so no one is stamped. Idempotent: a cleared plan is not matched again. An import applying
   * a preview holds that job's row lock (`claimPreview`), so this waits for it, then finds the plan gone.
   * Answers how many it cleared.
   */
  async clearExpiredPlans(importTypes: readonly ImportType[], cutoff: Date): Promise<number> {
    const { count } = await this.prisma.importJob.updateMany({
      where: {
        importType: { in: [...importTypes] },
        planJson: { not: Prisma.DbNull },
        OR: [{ createdAt: { lt: cutoff } }, { status: { not: "validating" } }],
      },
      data: { planJson: Prisma.DbNull },
    });
    return count;
  }

  /** Marks the preview imported with the import's report, and clears its plan. */
  async finishImport(
    id: string,
    outcome: ApplyOutcome,
    actorId: string,
    tx: Client,
  ): Promise<void> {
    await tx.importJob.update({
      where: { id },
      data: {
        status: "applied",
        rowCount: outcome.rowCount,
        errorReportJson: outcome.errorReportJson,
        planJson: Prisma.DbNull,
        updatedBy: actorId,
      },
    });
  }

  /**
   * Runs `work` inside one transaction, so the valid rows of an import land all-or-nothing. Prisma's
   * default timeout is 5 s; an import passes a longer one for a large file.
   */
  transaction<T>(
    work: (tx: Client) => Promise<T>,
    options?: { readonly timeout?: number; readonly maxWait?: number },
  ): Promise<T> {
    return this.prisma.$transaction(work, options);
  }
}
