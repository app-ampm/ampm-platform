import { Injectable } from "@nestjs/common";

import { PrismaService } from "../db/prisma.service.js";
import { Prisma } from "../generated/prisma/client.js";

export interface SessionRecord {
  readonly id: string;
  readonly userId: string;
  readonly tokenId: string;
  readonly idleTimeoutMinutes: number;
  readonly lastSeenAt: Date;
  readonly revokedAt: Date | null;
}

export interface NewSession {
  readonly userId: string;
  readonly tokenId: string;
  readonly idleTimeoutMinutes: number;
  readonly lastSeenAt: Date;
}

/** Whether this call inserted the row (`created`) or found one a concurrent request opened first. */
export interface OpenedSession {
  readonly created: boolean;
  readonly session: SessionRecord;
}

export abstract class SessionRepository {
  abstract findByTokenId(tokenId: string): Promise<SessionRecord | null>;
  /** Opens the session for a token, idempotently: a lost create race returns the winner's row. */
  abstract openSession(data: NewSession): Promise<OpenedSession>;
  abstract touchLastSeen(id: string, at: Date): Promise<void>;
  /** Revokes every live session of a user; returns the ids this call revoked, for the audit trail. */
  abstract revokeAllForUser(userId: string, reason: string, at: Date): Promise<string[]>;
}

@Injectable()
export class PrismaSessionRepository extends SessionRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByTokenId(tokenId: string): Promise<SessionRecord | null> {
    return this.prisma.session.findUnique({ where: { tokenId } });
  }

  async openSession(data: NewSession): Promise<OpenedSession> {
    try {
      const session = await this.prisma.session.create({ data });
      return { created: true, session };
    } catch (error) {
      // A concurrent first request for the same token won the insert on the unique `token_id`.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002")
        throw error;
      const session = await this.prisma.session.findUnique({ where: { tokenId: data.tokenId } });
      if (!session) throw error;
      return { created: false, session };
    }
  }

  async touchLastSeen(id: string, at: Date): Promise<void> {
    await this.prisma.session.update({ where: { id }, data: { lastSeenAt: at } });
  }

  async revokeAllForUser(userId: string, reason: string, at: Date): Promise<string[]> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: at, revokedReason: reason },
    });
    // Re-select exactly the rows this call revoked (its unique timestamp + reason), so the audited
    // set matches the revoked set even if a session was opened during the update.
    const revoked = await this.prisma.session.findMany({
      where: { userId, revokedAt: at, revokedReason: reason },
      select: { id: true },
    });
    return revoked.map((row) => row.id);
  }
}
