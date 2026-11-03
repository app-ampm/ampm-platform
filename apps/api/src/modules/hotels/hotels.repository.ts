import { Injectable } from "@nestjs/common";
import type { HotelListQuery, HotelReach, SavedHotelListQuery } from "@ampm/core";

import { PrismaService } from "../../db/prisma.service.js";
import { Prisma } from "../../generated/prisma/client.js";

/*
 * CLIENT-class columns only. The RESTRICTED-NOTES columns (internal_rating, internal_notes) are never
 * selected on this client path and hotel_contacts is never joined (security.md: one response model per
 * audience, built from the principal's classes — not a hide-flag). The destination is embedded so the
 * card and the detail render without an N+1. A staff/Finance hotel view would be a separate select.
 */
const HOTEL_SELECT = {
  id: true,
  slug: true,
  name: true,
  brand: true,
  starCategory: true,
  address: true,
  descriptionClient: true,
  website: true,
  totalRooms: true,
  streetViewRef: true,
  lastVerifiedAt: true,
  destination: {
    select: { id: true, name: true, slug: true, region: true, state: true, country: true },
  },
} as const;

/*
 * The detail adds the hotel's verified/stale rate cards with ONLY their client-visible items and the
 * backing verification's date (AC-04). The RESTRICTED card fields (source, internal_notes) are never
 * selected; draft and retired cards are excluded, so nothing unpublished reaches a client.
 */
const DETAIL_HOTEL_SELECT = {
  ...HOTEL_SELECT,
  rateCards: {
    where: { deletedAt: null, status: { in: ["verified", "stale"] } },
    orderBy: { name: "asc" },
    select: {
      status: true,
      verification: { select: { verifiedAt: true } },
      items: {
        where: { deletedAt: null, clientVisible: true },
        orderBy: { itemType: "asc" },
        select: { itemType: true, amount: true, amountMax: true, unit: true, inclusionsText: true },
      },
    },
  },
} as const satisfies Prisma.HotelSelect;

const SAVED_SELECT = {
  id: true,
  note: true,
  createdAt: true,
  hotel: { select: HOTEL_SELECT },
} as const;

export type HotelRow = Prisma.HotelGetPayload<{ select: typeof HOTEL_SELECT }>;
export type HotelDetailRow = Prisma.HotelGetPayload<{ select: typeof DETAIL_HOTEL_SELECT }>;
export type SavedHotelRow = Prisma.SavedHotelGetPayload<{ select: typeof SAVED_SELECT }>;

/** A destination plus its in-reach active-hotel count, composed from a grouped count (feature 9.4b). */
export interface DestinationBrowseRow {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly region: string | null;
  readonly state: string | null;
  readonly country: string;
  readonly hotelCount: number;
}

@Injectable()
export class HotelsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Catalogue scope (A-28, security.md). Reference data, not project-owned, so this does NOT use
   * recordScope(): always active + not soft-deleted; a demo principal sees only demo_visible rows; a
   * full subscription ("all_hotels") sees every active hotel. project_hotels / agreement_hotels reach is
   * a later increment (joins via wedding projects / service agreements) — until then it is empty, never
   * an unscoped read.
   */
  private reachWhere(reach: readonly HotelReach[]): Prisma.HotelWhereInput {
    const base: Prisma.HotelWhereInput = { status: "active", deletedAt: null };
    if (reach.includes("all_hotels")) return base;
    if (reach.includes("demo_hotels")) return { ...base, demoVisible: true };
    return { ...base, id: { in: [] } };
  }

  async list(
    reach: readonly HotelReach[],
    query: HotelListQuery,
  ): Promise<{ rows: HotelRow[]; nextCursor: string | null }> {
    const where = this.searchWhere(reach, query);
    const limit = query.limit;
    const hotels = await this.prisma.hotel.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: HOTEL_SELECT,
    });
    const hasMore = hotels.length > limit;
    const rows = hasMore ? hotels.slice(0, limit) : hotels;
    return { rows, nextCursor: hasMore ? rows[rows.length - 1]!.id : null };
  }

  /**
   * Build the catalogue WHERE: the reach scope (always) plus the optional discovery filters (feature 9.4,
   * AC-04.6). Each narrows within the reach — `minGuestCapacity` matches a hotel with a venue (banquet or
   * reception) seating at least N, `verifiedRatesOnly` one with a verified card carrying a client-visible
   * item. A `gte` on a nullable column (rooms, capacities) excludes unknown values, as a filter should. The
   * numeric filters guard on truthiness, so a 0 or an empty query param (`?minRooms=`, which coerces to 0)
   * is a no-op — a zero minimum is meaningless and must not silently exclude every unknown-value hotel.
   */
  private searchWhere(reach: readonly HotelReach[], query: HotelListQuery): Prisma.HotelWhereInput {
    const where = this.reachWhere(reach);
    if (query.destinationId) where.destinationId = query.destinationId;
    if (query.q) where.name = { contains: query.q, mode: "insensitive" };
    if (query.star) where.starCategory = query.star;
    if (query.minRooms) where.totalRooms = { gte: query.minRooms };
    if (query.minGuestCapacity) {
      where.venues = {
        some: {
          deletedAt: null,
          OR: [
            { capacityBanquet: { gte: query.minGuestCapacity } },
            { capacityReception: { gte: query.minGuestCapacity } },
          ],
        },
      };
    }
    if (query.verifiedRatesOnly) {
      where.rateCards = {
        some: {
          deletedAt: null,
          status: "verified",
          items: { some: { deletedAt: null, clientVisible: true } },
        },
      };
    }
    return where;
  }

  async findInReach(reach: readonly HotelReach[], hotelId: string): Promise<HotelRow | null> {
    // AND, never a spread: the empty-reach guard is `id: { in: [] }`, and a sibling `id: hotelId` in the
    // same object would clobber it (last key wins), reopening an out-of-reach hotel through the detail /
    // save path. Composing under AND keeps both predicates, so an empty reach still matches nothing.
    return this.prisma.hotel.findFirst({
      where: { AND: [this.reachWhere(reach), { id: hotelId }] },
      select: HOTEL_SELECT,
    });
  }

  /** The hotel detail with its client-facing pricing (same reach guard as findInReach, AND-composed). */
  async findDetailInReach(
    reach: readonly HotelReach[],
    hotelId: string,
  ): Promise<HotelDetailRow | null> {
    return this.prisma.hotel.findFirst({
      where: { AND: [this.reachWhere(reach), { id: hotelId }] },
      select: DETAIL_HOTEL_SELECT,
    });
  }

  /**
   * The detail rows for a bounded set of hotel ids that are in reach (compare, feature 9.4c). AND-composed
   * for the same reason as findInReach — an `id: { in }` beside the empty-reach guard's own `id: { in: [] }`
   * would clobber it. Out-of-reach ids simply do not match; the caller orders and maps what comes back.
   */
  async findDetailsInReach(
    reach: readonly HotelReach[],
    hotelIds: readonly string[],
  ): Promise<HotelDetailRow[]> {
    if (hotelIds.length === 0) return [];
    return this.prisma.hotel.findMany({
      where: { AND: [this.reachWhere(reach), { id: { in: [...hotelIds] } }] },
      select: DETAIL_HOTEL_SELECT,
    });
  }

  /**
   * The caller's own account from their contact row — never from the request (security.md). This reads a
   * CRM table (account_contacts) from Module C: a deliberate, recorded cross-module shortcut (D-063). The
   * same lookup lives in PortalService; both are to move onto the principal when consolidated.
   */
  async accountIdForUser(userId: string): Promise<string | null> {
    const contact = await this.prisma.accountContact.findFirst({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { accountId: true },
    });
    return contact ? contact.accountId : null;
  }

  /** Upsert the shortlist row (unique on account_id + hotel_id); a re-save clears a prior soft-delete. */
  async save(accountId: string, hotelId: string, userId: string): Promise<SavedHotelRow> {
    return this.prisma.savedHotel.upsert({
      where: { accountId_hotelId: { accountId, hotelId } },
      create: { accountId, hotelId, savedByUserId: userId, createdBy: userId },
      update: { deletedAt: null, updatedBy: userId },
      select: SAVED_SELECT,
    });
  }

  /** Soft-delete the shortlist row if present; idempotent — removing an unsaved hotel is a no-op. */
  async unsave(accountId: string, hotelId: string, userId: string): Promise<void> {
    await this.prisma.savedHotel.updateMany({
      where: { accountId, hotelId, deletedAt: null },
      data: { deletedAt: new Date(), updatedBy: userId },
    });
  }

  async listSaved(
    accountId: string,
    query: SavedHotelListQuery,
  ): Promise<{ rows: SavedHotelRow[]; nextCursor: string | null }> {
    const limit = query.limit;
    const saved = await this.prisma.savedHotel.findMany({
      where: { accountId, deletedAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: SAVED_SELECT,
    });
    const hasMore = saved.length > limit;
    const rows = hasMore ? saved.slice(0, limit) : saved;
    return { rows, nextCursor: hasMore ? rows[rows.length - 1]!.id : null };
  }

  /**
   * Which of the requested hotel ids are on this account's live shortlist (compare, feature 9.4c). Compare
   * is a view over saved_hotels, so an id the caller has not saved is not comparable; a soft-deleted saved
   * row (an un-saved hotel) does not count. Returns the saved subset as a set for the service to intersect.
   */
  async savedHotelIds(accountId: string, hotelIds: readonly string[]): Promise<Set<string>> {
    if (hotelIds.length === 0) return new Set();
    const rows = await this.prisma.savedHotel.findMany({
      where: { accountId, hotelId: { in: [...hotelIds] }, deletedAt: null },
      select: { hotelId: true },
    });
    return new Set(rows.map((r) => r.hotelId));
  }

  /**
   * Active destinations that have at least one active hotel in the caller's reach, each with that in-reach
   * count (CP-01/02, AC-04.5). The count uses the same reach predicate as the catalogue, so a destination's
   * number matches the hotels the caller can open; an empty reach yields none, and a draft destination is
   * excluded even if it has in-reach hotels. Counted by grouping hotels, then the destinations are fetched.
   */
  async listDestinations(reach: readonly HotelReach[]): Promise<DestinationBrowseRow[]> {
    const inReach = this.reachWhere(reach);
    const counts = await this.prisma.hotel.groupBy({
      by: ["destinationId"],
      where: inReach,
      _count: { _all: true },
    });
    const countByDestination = new Map(counts.map((c) => [c.destinationId, c._count._all]));
    if (countByDestination.size === 0) return [];
    const destinations = await this.prisma.destination.findMany({
      where: { status: "active", deletedAt: null, id: { in: [...countByDestination.keys()] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, region: true, state: true, country: true },
    });
    return destinations.map((d) => ({ ...d, hotelCount: countByDestination.get(d.id) ?? 0 }));
  }
}
