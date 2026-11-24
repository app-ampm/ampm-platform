import { Injectable } from "@nestjs/common";
import { normaliseRowName, type RateImportRow } from "@ampm/core";

import type { Prisma } from "../../generated/prisma/client.js";
import type { Principal } from "../../policy/principal.types.js";
import { rateImportGrantsOf } from "./hotel-audience.js";
import type { ImportRow } from "./hotel-import.file.js";
import {
  CHANGED_ERROR,
  changedSincePreview,
  type StoredRow,
  type StoredTarget,
} from "./hotel-import.job.js";
import {
  RATES_IMPORT,
  type AppliedRows,
  type ImportJobRef,
  type KindImporter,
  type PlannedRows,
} from "./hotel-import.kinds.js";
import {
  planRateRows,
  rateMatchOf,
  type RateItemRef,
  type RatePlanContext,
  type RateRowPlan,
  type StoredRateCard,
} from "./hotel-import.rates-plan.js";
import { RateRowsWriter } from "./hotel-import.rates-write.js";
import { refusedReport, type RowReport } from "./hotel-import.report.js";
import { HotelImportRepository, type ImportRateCardRow } from "./hotel-import.repository.js";
import { rateCardVersion, rateItemValuesOf, rateItemVersion } from "./hotel-import.version.js";
import { toDateString } from "./hotel-rates.view.js";

/*
 * The Rates import (TW-25; D-170, D-181, D-184; plan §4.8, Slice 4), over the rates planner
 * (hotel-import.rates-plan.ts). A preview reads the hotels its rows name, their live rooms and venues
 * (when a row names one) and their live cards that are not retired with their live items, and stores
 * each planned row with the version token of the item it matched, or of the stored card it adds an item
 * to; a row creating a card stores none. An import locks those hotels, then their live rooms, venues,
 * cards and items (each in id order), re-plans each stored row against them under the uploader's current
 * keys, refuses a row whose target changed since its preview, and writes the rest in its transaction,
 * each audited (hotel-import.rates-write.ts). It never deletes a card or an item, never changes a card,
 * and never touches an item's visibility.
 */

/** What the plan reads, and each stored card's and item's version token by id. */
interface RateLookup {
  readonly context: RatePlanContext;
  readonly versions: ReadonlyMap<string, string>;
}

/** Whether any row names a room, and any a venue: only then are they read and locked. */
interface Named {
  readonly rooms: boolean;
  readonly venues: boolean;
}

const unique = (values: readonly string[]): string[] => [...new Set(values)];

@Injectable()
export class RatesImporter implements KindImporter<RateImportRow> {
  readonly spec = RATES_IMPORT;

  constructor(
    private readonly imports: HotelImportRepository,
    private readonly writer: RateRowsWriter,
  ) {}

  async plan(
    rows: readonly ImportRow<RateImportRow>[],
    principal: Principal,
  ): Promise<PlannedRows> {
    const { context, versions } = await this.lookUp(rows, principal);
    const plans = planRateRows(rows, context);
    const stored = plans.flatMap((plan, index) => {
      const row = rows[index];
      if (plan.outcome === "error" || row === undefined) return [];
      return [{ line: row.line, row: this.spec.toJson(row.row), target: targetOf(plan, versions) }];
    });
    return { reports: plans.map(reportOf), stored, newDestinations: 0, newImages: 0 };
  }

  async apply(
    stored: readonly StoredRow<RateImportRow>[],
    principal: Principal,
    job: ImportJobRef,
    tx: Prisma.TransactionClient,
  ): Promise<AppliedRows> {
    const rows = stored.map(({ line, row }) => ({ line, row }));
    await this.imports.lockHotelsBySlug(unique(rows.map(({ row }) => row.hotelSlug)), tx);
    const { context, versions } = await this.lookUp(rows, principal, tx);
    const rechecked = planRateRows(rows, context).map((plan, index) =>
      recheck(plan, stored[index]?.target ?? null, versions),
    );
    const plans = holdNewCards(rechecked, stored);
    await this.writer.writeRows(plans, job, tx);
    return { reports: plans.map(reportOf), newDestinations: 0, imageRefs: [] };
  }

  afterCommit(): Promise<number> {
    return Promise.resolve(0);
  }

  /**
   * The hotels the rows name (deleted ones included), and of the live ones their live rooms and venues
   * and their cards that are not retired, each name in NFC as the file's text is (`decodeCsv`), so two
   * spellings of one name match each other. Inside an import's transaction the rows are locked before
   * they are read.
   */
  private async lookUp(
    rows: readonly ImportRow<RateImportRow>[],
    principal: Principal,
    tx?: Prisma.TransactionClient,
  ): Promise<RateLookup> {
    const slugs = unique(rows.map(({ row }) => row.hotelSlug));
    const hotels = await this.imports.findHotelRefsBySlugs(slugs, tx);
    const live = hotels.filter((hotel) => hotel.deletedAt === null).map((hotel) => hotel.id);
    const named: Named = {
      rooms: rows.some(({ row }) => row.roomName !== undefined),
      venues: rows.some(({ row }) => row.venueName !== undefined),
    };
    if (tx) await this.lock(live, named, tx);
    const rooms = named.rooms ? await this.imports.findLiveRooms(live, tx) : [];
    const venues = named.venues ? await this.imports.findLiveVenues(live, tx) : [];
    const cards = await this.imports.findLiveRateCards(live, tx);
    const context: RatePlanContext = {
      hotels: new Map(hotels.map((hotel) => [hotel.slug, hotel])),
      cards: byHotel(cards, toStoredCard),
      rooms: byHotel(rooms, toRef),
      venues: byHotel(venues, toRef),
      grants: rateImportGrantsOf(principal),
    };
    return { context, versions: versionsOf(cards) };
  }

  /**
   * Locks what the re-plan reads, after the hotels: rooms and venues shared (read, never written, and a
   * staff item edit's foreign-key check must not wait on them), then cards and their items for update.
   */
  private async lock(hotelIds: readonly string[], named: Named, tx: Prisma.TransactionClient) {
    if (named.rooms) await this.imports.shareLiveRooms(hotelIds, tx);
    if (named.venues) await this.imports.shareLiveVenues(hotelIds, tx);
    const cardIds = await this.imports.lockLiveRateCards(hotelIds, tx);
    await this.imports.lockLiveRateItems(cardIds, tx);
  }
}

/** Rows grouped by their hotel, each as the plan reads it. */
function byHotel<Row extends { readonly hotelId: string }, Value>(
  rows: readonly Row[],
  as: (row: Row) => Value,
): Map<string, Value[]> {
  const grouped = new Map<string, Value[]>();
  for (const row of rows) {
    const values = grouped.get(row.hotelId);
    if (values) values.push(as(row));
    else grouped.set(row.hotelId, [as(row)]);
  }
  return grouped;
}

/** A live room or venue as a rates row names it: by name, in NFC. */
function toRef(row: { readonly id: string; readonly name: string }): RateItemRef {
  return { id: row.id, name: row.name.normalize("NFC") };
}

/** A stored card as the plan reads it: its name in NFC, its dates as YYYY-MM-DD, its items' values. */
function toStoredCard(row: ImportRateCardRow): StoredRateCard {
  return {
    id: row.id,
    name: row.name.normalize("NFC"),
    status: row.status,
    validFrom: toDateString(row.validFrom),
    validTo: toDateString(row.validTo),
    items: row.items.map((item) => ({
      id: item.id,
      itemType: item.itemType,
      roomCategoryId: item.roomCategoryId,
      venueId: item.venueId,
      values: rateItemValuesOf(item),
    })),
  };
}

/** Each stored card's token (its status and dates) and each of its items' (its price and terms). */
function versionsOf(cards: readonly ImportRateCardRow[]): Map<string, string> {
  const versions = new Map<string, string>();
  for (const card of cards) {
    versions.set(card.id, rateCardVersion(card));
    for (const item of card.items) versions.set(item.id, rateItemVersion(item));
  }
  return versions;
}

/** What a planned row's import checks again: the item it matched, else the stored card it adds to. */
function targetOf(plan: RateRowPlan, versions: ReadonlyMap<string, string>): StoredTarget | null {
  const match = rateMatchOf(plan);
  const id =
    match.matches === "row"
      ? match.targetId
      : match.matches === "none"
        ? match.parentId
        : undefined;
  return id === undefined ? null : { id, version: versions.get(id) ?? "" };
}

/**
 * A re-planned row, refused when its target changed since the preview: decided from what the re-plan
 * matched (`rateMatchOf`), so a row whose card was renamed is refused as changed, not for what a new card
 * would need.
 */
function recheck(
  plan: RateRowPlan,
  target: StoredTarget | null,
  versions: ReadonlyMap<string, string>,
): RateRowPlan {
  const match = rateMatchOf(plan);
  if (!changedSincePreview(target, match, (id) => versions.get(id) ?? null)) return plan;
  return changed(plan);
}

/** A plan refused as changed since its preview, keeping what it matched. */
function changed(plan: RateRowPlan): RateRowPlan {
  const { line, slug, name, item } = plan;
  return {
    line,
    slug,
    name,
    item,
    outcome: "error",
    errors: [CHANGED_ERROR],
    match: rateMatchOf(plan),
  };
}

/** A new card's key as the plan groups its rows: the hotel's web address and the card's name. */
const newCardKey = (row: RateImportRow): string =>
  `${row.hotelSlug}\u0000${normaliseRowName(row.cardName)}`;

/**
 * New cards held to their previews (D-184): a stored row without a target was a new card's at the
 * preview, and the first such row of a card made it, with its name and dates. When that row is refused
 * at import, the card cannot be made as previewed, so every other row of it is refused as changed since
 * the preview, rather than make the card from another row under other dates. That includes a row the
 * re-plan refused against the other row's dates: validating again shows each row's own reason.
 */
function holdNewCards(
  plans: readonly RateRowPlan[],
  stored: readonly StoredRow<RateImportRow>[],
): RateRowPlan[] {
  const keys = stored.map(({ row, target }) => (target === null ? newCardKey(row) : null));
  const makers = new Map<string, number>();
  keys.forEach((key, index) => {
    if (key !== null && !makers.has(key)) makers.set(key, index);
  });
  const lost = new Set(
    [...makers].filter(([, index]) => plans[index]?.outcome === "error").map(([key]) => key),
  );
  return plans.map((plan, index) => {
    const key = keys[index] ?? null;
    if (key === null || !lost.has(key) || makers.get(key) === index) return plan;
    return changed(plan);
  });
}

/** One plan as the report shows it, a refused plan by what its refusal kept (its own cells, mostly). */
function reportOf(plan: RateRowPlan): RowReport {
  const key = { line: plan.line, slug: plan.slug, name: plan.name, item: plan.item };
  if (plan.outcome === "error") return refusedReport(key, plan.errors);
  const changedFields = plan.outcome === "unchanged" ? [] : plan.changedFields;
  return { ...key, outcome: plan.outcome, changedFields, errors: [] };
}
