import { Injectable } from "@nestjs/common";
import { HOTEL_INFO_REQUEST_LIVE_STATUSES, type HotelStatus } from "@ampm/core";

import { PrismaService } from "../../db/prisma.service.js";
import type { HotelInfoRequestStatus, Prisma } from "../../generated/prisma/client.js";
import type { HintCandidate } from "./hotel-duplicate-hints.js";

/*
 * Hotel information requests and their events (D-188 §1), for the staff routes: Module C reads the
 * hotels and destinations it owns here too. `token_hash` is never selected: the link's hash is written
 * here and read only by Slice 7b's lookup. Soft-deleted requests are left out of every read. Writes take
 * the transaction they belong to, so a change and its event and audit commit together; a change reads
 * its request through `lockById` and writes it through `updateIf`, so it never lands on a request that
 * moved meanwhile.
 */

/** Every column a view reads, with the hotel's and the proposed destination's names. */
const REQUEST_SELECT = {
  id: true,
  reference: true,
  kind: true,
  target: true,
  hotelId: true,
  proposedName: true,
  proposedDestinationId: true,
  proposedWebAddress: true,
  officialWebsite: true,
  switchboardPhone: true,
  switchboardSource: true,
  isTest: true,
  status: true,
  expiresAt: true,
  statusOnlyUntil: true,
  displayLabel: true,
  staffNote: true,
  tokenGeneration: true,
  linkIssuedAt: true,
  linkEmailedAt: true,
  recipientName: true,
  recipientEmail: true,
  revokedAt: true,
  revokeReason: true,
  createdAt: true,
  updatedAt: true,
  hotel: { select: { name: true, destination: { select: { name: true } } } },
  proposedDestination: { select: { name: true } },
} as const satisfies Prisma.HotelInfoRequestSelect;

const EVENT_SELECT = {
  id: true,
  eventType: true,
  actorKind: true,
  actorUserId: true,
  detail: true,
  occurredAt: true,
} as const satisfies Prisma.HotelInfoRequestEventSelect;

export type RequestRow = Prisma.HotelInfoRequestGetPayload<{ select: typeof REQUEST_SELECT }>;
export type RequestEventRow = Prisma.HotelInfoRequestEventGetPayload<{
  select: typeof EVENT_SELECT;
}>;

/** A live request's identity: what a 409 names. */
export interface LiveRequestRef {
  readonly id: string;
  readonly reference: string;
  readonly status: HotelInfoRequestStatus;
}

/** What the hotel form's send gate reads of a request. */
export interface SendGateState {
  readonly isTest: boolean;
  readonly status: HotelInfoRequestStatus;
  readonly tokenGeneration: number;
  /** Set at the merge: a code SMS still goes until then (D-189 §2). */
  readonly statusOnlyUntil: Date | null;
}

/** A hotel a request may name, locked for the transaction. */
export interface LockedHotel {
  readonly id: string;
  readonly name: string;
  readonly status: HotelStatus;
}

/** The inbox's filters. */
export interface RequestFilters {
  readonly status?: HotelInfoRequestStatus | undefined;
  readonly kind?: "onboarding" | "refresh" | undefined;
  readonly includeTests: boolean;
}

/** A page of requests. */
export interface RequestPage {
  readonly rows: RequestRow[];
  readonly nextCursor: string | null;
}

const LIVE = [...HOTEL_INFO_REQUEST_LIVE_STATUSES];

@Injectable()
export class HotelInfoRequestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string, tx?: Prisma.TransactionClient): Promise<RequestRow | null> {
    return (tx ?? this.prisma).hotelInfoRequest.findFirst({
      where: { id, deletedAt: null },
      select: REQUEST_SELECT,
    });
  }

  /**
   * Locks a request's row until the transaction ends, then reads it: every change takes this first, so
   * a change that meets a revoke (or another change) still writing waits for it to commit and then reads
   * what it left, never the request as it was. A hotel's row is locked before its request's, never after.
   * Null when there is none, or it was deleted.
   */
  async lockById(id: string, tx: Prisma.TransactionClient): Promise<RequestRow | null> {
    await tx.$queryRaw`
      SELECT id FROM hotel_info_requests WHERE id = ${id}::uuid AND deleted_at IS NULL FOR UPDATE`;
    return this.findById(id, tx);
  }

  /** Requests newest first (UUID v7 ids follow creation), by cursor. */
  async list(filters: RequestFilters, limit: number, cursor?: string): Promise<RequestPage> {
    const where: Prisma.HotelInfoRequestWhereInput = { deletedAt: null };
    if (filters.status) where.status = filters.status;
    if (filters.kind) where.kind = filters.kind;
    if (!filters.includeTests) where.isTest = false;
    return this.page(where, limit, cursor);
  }

  /** One hotel's requests, newest first, tests included. */
  listForHotel(hotelId: string, limit: number, cursor?: string): Promise<RequestPage> {
    return this.page({ hotelId, deletedAt: null }, limit, cursor);
  }

  /** The latest events of a request, newest first. */
  latestEvents(
    requestId: string,
    limit: number,
    tx?: Prisma.TransactionClient,
  ): Promise<RequestEventRow[]> {
    return (tx ?? this.prisma).hotelInfoRequestEvent.findMany({
      where: { requestId, deletedAt: null },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: limit,
      select: EVENT_SELECT,
    });
  }

  /** The detail of a request's first extension, which records the first expiry; null when none. */
  async firstExtensionDetail(
    requestId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Prisma.JsonValue | null> {
    const event = await (tx ?? this.prisma).hotelInfoRequestEvent.findFirst({
      where: { requestId, eventType: "expiry_extended", deletedAt: null },
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
      select: { detail: true },
    });
    return event?.detail ?? null;
  }

  /**
   * What the hotel form's send gate reads of a request (D-188 §5, D-189 §2): whether it is a test (what
   * test_only admits), its status, its link's generation and the end of its status-only window. Null when
   * there is none, or it was deleted.
   */
  sendGateState(id: string): Promise<SendGateState | null> {
    return this.prisma.hotelInfoRequest.findFirst({
      where: { id, deletedAt: null },
      select: { isTest: true, status: true, tokenGeneration: true, statusOnlyUntil: true },
    });
  }

  hotelExists(hotelId: string): Promise<boolean> {
    return this.prisma.hotel
      .count({ where: { id: hotelId, deletedAt: null } })
      .then((count) => count > 0);
  }

  /**
   * Locks a live hotel's row until the transaction ends, so a request is never created for a hotel that
   * is being deleted, nor a deletion missing a request created meanwhile. Null when there is none.
   */
  async lockLiveHotel(hotelId: string, tx: Prisma.TransactionClient): Promise<LockedHotel | null> {
    const rows = await tx.$queryRaw<LockedHotel[]>`
      SELECT id, name, status::text AS status FROM hotels
      WHERE id = ${hotelId}::uuid AND deleted_at IS NULL FOR UPDATE`;
    return rows[0] ?? null;
  }

  /** Locks a hotel's row, live or not, until the transaction ends: the deletion's side of the lock. */
  async lockHotel(hotelId: string, tx: Prisma.TransactionClient): Promise<void> {
    await tx.$queryRaw`SELECT id FROM hotels WHERE id = ${hotelId}::uuid FOR UPDATE`;
  }

  findDestination(
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<{ id: string; name: string } | null> {
    return tx.destination.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true },
    });
  }

  findLiveForHotel(hotelId: string, tx: Prisma.TransactionClient): Promise<LiveRequestRef | null> {
    return tx.hotelInfoRequest.findFirst({
      where: { hotelId, status: { in: LIVE }, deletedAt: null },
      select: { id: true, reference: true, status: true },
    });
  }

  findLiveForAddress(
    addressKey: string,
    tx: Prisma.TransactionClient,
  ): Promise<LiveRequestRef | null> {
    return tx.hotelInfoRequest.findFirst({
      where: {
        proposedWebAddressKey: addressKey,
        target: "new",
        status: { in: LIVE },
        deletedAt: null,
      },
      select: { id: true, reference: true, status: true },
    });
  }

  async create(
    data: Prisma.HotelInfoRequestUncheckedCreateInput,
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const row = await tx.hotelInfoRequest.create({ data, select: { id: true } });
    return row.id;
  }

  /**
   * Writes a change only while the request still is as read (its status, and for a reissue its link's
   * generation), so two changes racing never both land: 1 when it was written, 0 when it had moved.
   */
  async updateIf(
    id: string,
    expected: {
      readonly statuses: readonly HotelInfoRequestStatus[];
      readonly generation?: number;
    },
    data: Prisma.HotelInfoRequestUncheckedUpdateManyInput,
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    const { count } = await tx.hotelInfoRequest.updateMany({
      where: {
        id,
        deletedAt: null,
        status: { in: [...expected.statuses] },
        ...(expected.generation === undefined ? {} : { tokenGeneration: expected.generation }),
      },
      data,
    });
    return count;
  }

  /** Marks a request emailed, while the link emailed is still its link (that generation): 1, else 0. */
  async markEmailed(
    id: string,
    generation: number,
    at: Date,
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    const { count } = await tx.hotelInfoRequest.updateMany({
      where: { id, tokenGeneration: generation, deletedAt: null },
      data: { linkEmailedAt: at },
    });
    return count;
  }

  async addEvent(
    data: Prisma.HotelInfoRequestEventUncheckedCreateInput,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.hotelInfoRequestEvent.create({ data, select: { id: true } });
  }

  /**
   * Every catalogue hotel the duplicate hints compare, deleted ones included. The catalogue is a few
   * hundred hotels, and accents are compared in code (no `unaccent` here), so it is read whole.
   */
  hintCandidates(): Promise<HintCandidate[]> {
    return this.prisma.hotel.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        status: true,
        nameAliases: true,
        website: true,
        deletedAt: true,
        destination: { select: { name: true } },
      },
    });
  }

  /** Runs `work` in one transaction: a change, its event and its audit commit together. */
  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }

  private async page(
    where: Prisma.HotelInfoRequestWhereInput,
    limit: number,
    cursor?: string,
  ): Promise<RequestPage> {
    const rows = await this.prisma.hotelInfoRequest.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: REQUEST_SELECT,
    });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return { rows: items, nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null };
  }
}
