import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../db/prisma.service.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { LIVE_NOTICE_CONSENT } from "./hotel-form-named-person.js";
import { FORM_REQUEST_SELECT, toFormRequest } from "./hotel-form-requests.repository.js";
import type { FormRequest } from "./hotel-form-state.js";

/*
 * Hotel form sessions (D-189 §5): each is carried by the challenge whose correct code opened it, found by
 * the SHA-256 of its `hfs_` token (unique), with what the guard re-checks on every call: the request (its
 * link's generation, status, expiry and deletion, and its hotel's) and the person (removed or deleted).
 */

/** A session as the guard reads it. */
export interface SessionRecord {
  readonly challengeId: string;
  readonly requestId: string;
  /** The link generation the session's code was issued on. */
  readonly linkGeneration: number;
  readonly tokenHash: string;
  readonly startedAt: Date;
  readonly lastSeenAt: Date | null;
  readonly endedAt: Date | null;
  readonly person: {
    readonly id: string;
    readonly fullName: string;
    readonly designation: string;
    readonly isGone: boolean;
  };
  /** The request, or null when it was deleted. */
  readonly request: FormRequest | null;
}

/** A person's session that has not ended, for the three-session rule. */
export interface OpenSession {
  readonly id: string;
  readonly startedAt: Date;
  readonly lastSeenAt: Date | null;
}

const SESSION_SELECT = {
  id: true,
  requestId: true,
  linkGeneration: true,
  sessionTokenHash: true,
  sessionStartedAt: true,
  sessionLastSeenAt: true,
  sessionEndedAt: true,
  person: {
    select: { id: true, fullName: true, designation: true, removedAt: true, deletedAt: true },
  },
  request: { select: { ...FORM_REQUEST_SELECT, deletedAt: true } },
} as const satisfies Prisma.HotelInfoRequestChallengeSelect;

type SessionRow = Prisma.HotelInfoRequestChallengeGetPayload<{ select: typeof SESSION_SELECT }>;

/** A session row as the guard reads it; null for a row the CHECKs say cannot be a session. */
function toSessionRecord(row: SessionRow): SessionRecord | null {
  const { person, request, sessionTokenHash, sessionStartedAt } = row;
  if (person === null || sessionTokenHash === null || sessionStartedAt === null) return null;
  const { deletedAt, ...live } = request;
  return {
    challengeId: row.id,
    requestId: row.requestId,
    linkGeneration: row.linkGeneration,
    tokenHash: sessionTokenHash,
    startedAt: sessionStartedAt,
    lastSeenAt: row.sessionLastSeenAt,
    endedAt: row.sessionEndedAt,
    person: {
      id: person.id,
      fullName: person.fullName,
      designation: person.designation,
      isGone: person.removedAt !== null || person.deletedAt !== null,
    },
    request: deletedAt === null ? toFormRequest(live) : null,
  };
}

@Injectable()
export class HotelFormSessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The session whose token's hash this is, with its request and person; null when none. */
  async findByTokenHash(hash: string): Promise<SessionRecord | null> {
    const row = await this.prisma.hotelInfoRequestChallenge.findFirst({
      where: { sessionTokenHash: hash, deletedAt: null },
      select: SESSION_SELECT,
    });
    return row === null ? null : toSessionRecord(row);
  }

  /** A person's sessions that have not ended, expired ones included (the caller tells them apart). */
  openSessionsOf(personId: string, tx: Prisma.TransactionClient): Promise<OpenSession[]> {
    return tx.hotelInfoRequestChallenge
      .findMany({
        where: { personId, sessionTokenHash: { not: null }, sessionEndedAt: null, deletedAt: null },
        select: { id: true, sessionStartedAt: true, sessionLastSeenAt: true },
      })
      .then((rows) =>
        rows.flatMap((row) =>
          row.sessionStartedAt === null
            ? []
            : [{ id: row.id, startedAt: row.sessionStartedAt, lastSeenAt: row.sessionLastSeenAt }],
        ),
      );
  }

  /** Ends these sessions at `at`; one already ended keeps its end. */
  async endSessions(ids: readonly string[], at: Date, tx: Prisma.TransactionClient): Promise<void> {
    if (ids.length === 0) return;
    await tx.hotelInfoRequestChallenge.updateMany({
      where: { id: { in: [...ids] }, sessionEndedAt: null },
      data: { sessionEndedAt: at },
    });
  }

  /**
   * Whether a session is still open as a call holding its request's lock sees it: not ended, and its person
   * still holding a live privacy notice consent. Withdrawing every consent ends the person's sessions and
   * takes that consent back in one transaction under the same lock, so either says the session is over.
   */
  async isOpen(
    challengeId: string,
    personId: string,
    tx: Prisma.TransactionClient,
  ): Promise<boolean> {
    const row = await tx.hotelInfoRequestChallenge.findFirst({
      where: {
        id: challengeId,
        personId,
        sessionTokenHash: { not: null },
        sessionEndedAt: null,
        deletedAt: null,
        person: { is: { consents: { some: LIVE_NOTICE_CONSENT } } },
      },
      select: { id: true },
    });
    return row !== null;
  }

  /** Ends one session (sign-out); false when it had already ended. */
  async endSession(challengeId: string, at: Date, tx: Prisma.TransactionClient): Promise<boolean> {
    const { count } = await tx.hotelInfoRequestChallenge.updateMany({
      where: { id: challengeId, sessionTokenHash: { not: null }, sessionEndedAt: null },
      data: { sessionEndedAt: at },
    });
    return count === 1;
  }

  /** Records that a session and its person were seen at `at`. */
  async touch(challengeId: string, personId: string, at: Date): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.hotelInfoRequestChallenge.update({
        where: { id: challengeId },
        data: { sessionLastSeenAt: at },
        select: { id: true },
      }),
      this.prisma.hotelInfoRequestPerson.update({
        where: { id: personId },
        data: { lastSeenAt: at },
        select: { id: true },
      }),
    ]);
  }
}
