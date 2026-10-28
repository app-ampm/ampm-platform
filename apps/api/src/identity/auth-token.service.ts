import { createHash, randomBytes } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { PrismaService } from "../db/prisma.service.js";
import { Prisma } from "../generated/prisma/client.js";

/**
 * How long an invite stays valid before it must be reissued. A threshold that should move to a
 * `configurations` key when the auth config lands; a constant keeps feature 5.2 self-contained.
 */
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** A high-entropy random token is looked up by a fast hash — the right primitive, unlike a password. */
function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export interface ValidInvite {
  readonly id: string;
  readonly userId: string;
}

/**
 * The invite/link tokens the API itself mints (`auth_tokens`); credentials, OTP and TOTP stay with
 * the identity service (T-6). Feature 5.2 uses the `invite` purpose: a single-use, expiring token
 * delivered out of band, exchanged at activation. Only the token's sha256 hash is ever stored.
 */
@Injectable()
export class AuthTokenService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Issues an invite for a user, retiring any still-live one (one live invite per user), and returns
   * the RAW token to deliver. The caller passes its transaction client so the invite and the user
   * creation commit together.
   */
  async issueInvite(
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<string> {
    const raw = randomBytes(32).toString("base64url");
    await client.authToken.updateMany({
      where: { userId, purpose: "invite", usedAt: null },
      data: { usedAt: new Date() },
    });
    await client.authToken.create({
      data: {
        userId,
        purpose: "invite",
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    });
    return raw;
  }

  /** The valid (unused, unexpired) invite matching this raw token, or null. */
  async findValidInvite(raw: string): Promise<ValidInvite | null> {
    return this.prisma.authToken.findFirst({
      where: {
        purpose: "invite",
        tokenHash: hashToken(raw),
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, userId: true },
    });
  }

  /**
   * Marks an invite used only while it is still live, returning whether this call claimed it. The
   * `usedAt: null` guard makes redemption atomic under concurrency: of two racing activations of the
   * same token, exactly one gets `true`.
   */
  async markUsedIfLive(
    id: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<boolean> {
    const result = await client.authToken.updateMany({
      where: { id, usedAt: null },
      data: { usedAt: new Date() },
    });
    return result.count === 1;
  }
}
