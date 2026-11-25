import { Injectable } from "@nestjs/common";
import type { HotelFormCodeDelivery } from "@ampm/core";

import { PrismaService } from "../../../db/prisma.service.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import type { BurnedChallenge } from "./hotel-form-lock.js";

/*
 * The hotel form's code challenges (D-189 §1 and §2). A challenge holds its claimant's details only while
 * it is open (neither used nor retired): every update that sets `used_at` or `retired_at` clears the claim
 * in the same statement, as the CHECK hotel_info_request_challenges_claim_cleared requires. The code is
 * stored only as its HMAC, and each try is reserved by an atomic increment before the code is compared.
 */

/** The most tries a code allows (the CHECK hotel_info_request_challenges_attempts_range). */
export const CODE_TRIES = 5;

/** Setting `used_at` or `retired_at` clears the claim in the same update. */
const CLAIM_CLEARED = {
  claimedFullName: null,
  claimedDesignation: null,
  claimedPhone: null,
  claimedNoticeVersion: null,
} as const;

/** An open challenge: neither used nor retired, nor deleted. */
const OPEN = { usedAt: null, retiredAt: null, deletedAt: null } as const;

/** A challenge as verify reads it before its first try. */
export interface ChallengeRow {
  readonly id: string;
  readonly linkGeneration: number;
  readonly delivery: HotelFormCodeDelivery;
  readonly codeHmac: string;
}

/** What a claimant gave, held on the challenge until the code is entered. */
export interface ChallengeClaim {
  readonly fullName: string;
  readonly designation: string;
  readonly phone: string;
  readonly noticeVersion: string;
}

/** A new challenge, with its claim and its code's HMAC. */
export type NewChallenge = Pick<
  Prisma.HotelInfoRequestChallengeUncheckedCreateInput,
  | "id"
  | "requestId"
  | "linkGeneration"
  | "claimedFullName"
  | "claimedDesignation"
  | "claimedPhone"
  | "claimedNoticeVersion"
  | "delivery"
  | "destinationHash"
  | "codeHmac"
  | "codeExpiresAt"
  | "ipAddress"
  | "userAgent"
>;

@Injectable()
export class HotelFormChallengesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The latest burned challenges of a mobile on a request since `since`, newest first: their 5 tries spent
   * without the right code. Three are all the lock reads.
   */
  recentBurns(requestId: string, destinationHash: string, since: Date): Promise<BurnedChallenge[]> {
    return this.prisma.hotelInfoRequestChallenge.findMany({
      where: {
        requestId,
        destinationHash,
        createdAt: { gte: since },
        attempts: CODE_TRIES,
        usedAt: null,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { createdAt: true, retiredAt: true },
    });
  }

  /** Retires the open challenges of a mobile on a request, clearing their claims: a new code replaces them. */
  async retireOpen(
    requestId: string,
    destinationHash: string,
    at: Date,
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    const { count } = await tx.hotelInfoRequestChallenge.updateMany({
      where: { requestId, destinationHash, ...OPEN },
      data: { retiredAt: at, ...CLAIM_CLEARED },
    });
    return count;
  }

  async create(data: NewChallenge, tx: Prisma.TransactionClient): Promise<void> {
    await tx.hotelInfoRequestChallenge.create({ data, select: { id: true } });
  }

  /** A challenge of this request, by id; null when it is another request's, or none. */
  find(id: string, requestId: string): Promise<ChallengeRow | null> {
    return this.prisma.hotelInfoRequestChallenge.findFirst({
      where: { id, requestId, deletedAt: null },
      select: { id: true, linkGeneration: true, delivery: true, codeHmac: true },
    });
  }

  /**
   * Reserves one try before the code is compared: an increment that lands only while the challenge is
   * open, unexpired and under 5 tries, so guesses sent at once share the five. False when it did not land.
   */
  async reserveTry(id: string, now: Date): Promise<boolean> {
    const { count } = await this.prisma.hotelInfoRequestChallenge.updateMany({
      where: { id, ...OPEN, codeExpiresAt: { gt: now }, attempts: { lt: CODE_TRIES } },
      data: { attempts: { increment: 1 } },
    });
    return count === 1;
  }

  /** Retires a challenge whose tries are spent, clearing its claim at once; true when it did. */
  async retireIfSpent(id: string, at: Date): Promise<boolean> {
    const { count } = await this.prisma.hotelInfoRequestChallenge.updateMany({
      where: { id, ...OPEN, attempts: { gte: CODE_TRIES } },
      data: { retiredAt: at, ...CLAIM_CLEARED },
    });
    return count === 1;
  }

  /** Retires one challenge whatever its tries (its SMS could not be queued), clearing its claim. */
  async retire(id: string, at: Date): Promise<void> {
    await this.prisma.hotelInfoRequestChallenge.updateMany({
      where: { id, ...OPEN },
      data: { retiredAt: at, ...CLAIM_CLEARED },
    });
  }

  /** Locks an open challenge's row for the transaction and reads its claim; null once used or retired. */
  async lockClaim(id: string, tx: Prisma.TransactionClient): Promise<ChallengeClaim | null> {
    const rows = await tx.$queryRaw<
      {
        full_name: string | null;
        designation: string | null;
        phone: string | null;
        notice: string | null;
      }[]
    >`
      SELECT claimed_full_name AS full_name, claimed_designation AS designation,
             claimed_phone AS phone, claimed_notice_version AS notice
      FROM hotel_info_request_challenges
      WHERE id = ${id}::uuid AND used_at IS NULL AND retired_at IS NULL AND deleted_at IS NULL
      FOR UPDATE`;
    const row = rows[0];
    if (!row?.full_name || !row.designation || !row.phone || !row.notice) return null;
    return {
      fullName: row.full_name,
      designation: row.designation,
      phone: row.phone,
      noticeVersion: row.notice,
    };
  }

  /**
   * Spends an open challenge on the person it verified and opens its session, clearing the claim in the
   * same update; false when it was used or retired meanwhile.
   */
  async markUsed(
    id: string,
    use: { readonly personId: string; readonly sessionTokenHash: string; readonly at: Date },
    tx: Prisma.TransactionClient,
  ): Promise<boolean> {
    const { count } = await tx.hotelInfoRequestChallenge.updateMany({
      where: { id, ...OPEN },
      data: {
        usedAt: use.at,
        personId: use.personId,
        sessionTokenHash: use.sessionTokenHash,
        sessionStartedAt: use.at,
        sessionLastSeenAt: use.at,
        ...CLAIM_CLEARED,
      },
    });
    return count === 1;
  }

  /**
   * Retires every open challenge whose code expired by `now`, clearing its claim: the hourly sweep, so an
   * abandoned claim is never kept longer than an hour past its code. A second run finds none.
   */
  async retireExpired(now: Date): Promise<number> {
    const { count } = await this.prisma.hotelInfoRequestChallenge.updateMany({
      where: { ...OPEN, codeExpiresAt: { lte: now } },
      data: { retiredAt: now, ...CLAIM_CLEARED },
    });
    return count;
  }
}
