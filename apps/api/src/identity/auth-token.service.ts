import { createHash, randomBytes } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { PrismaService } from "../db/prisma.service.js";
import { Prisma } from "../generated/prisma/client.js";

/**
 * How long an invite stays valid before it must be reissued. A threshold that should move to a
 * `configurations` key when the auth config lands; a constant keeps feature 5.2 self-contained.
 */
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** The window between a correct password and the authenticator code (D-142). */
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
/** How long an emailed password-reset link works. */
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
/** Wrong codes a sign-in challenge takes before it is burned and the sign-in starts again. */
export const CHALLENGE_MAX_ATTEMPTS = 5;

/** The short-lived tokens of AMPM's own sign-in, with how long each lives. */
const SIGN_IN_TOKEN_TTL_MS = {
  sign_in_challenge: CHALLENGE_TTL_MS,
  password_reset: PASSWORD_RESET_TTL_MS,
} as const;
export type SignInTokenPurpose = keyof typeof SIGN_IN_TOKEN_TTL_MS;

/** A high-entropy random token is looked up by a fast hash — the right primitive, unlike a password. */
function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export interface ValidInvite {
  readonly id: string;
  readonly userId: string;
}

/** A live sign-in challenge or reset token: who it is for, and how many wrong answers it has taken. */
/** A client's live one-time code: its row, its HMAC and the wrong tries so far (D-147). */
export interface LiveCode {
  readonly id: string;
  readonly tokenHash: string;
  readonly attempts: number;
}

export interface LiveToken {
  readonly id: string;
  readonly userId: string;
  readonly attempts: number;
}

/**
 * Issues an invite for a user through the given client, retiring any still-live one (one live invite
 * per user), and returns the RAW token to deliver. Exported so a command-line bootstrap outside Nest
 * (prisma/bootstrap.ts) mints exactly the token the app accepts at activation.
 *
 * @example
 * const raw = await issueInviteToken(tx, user.id); // deliver `${WEB_APP_URL}/activate?token=${raw}`
 */
export async function issueInviteToken(
  client: Prisma.TransactionClient,
  userId: string,
): Promise<string> {
  return issueToken(client, userId, "invite", INVITE_TTL_MS);
}

/** Mints a token of one purpose for a user, retiring their still-live one of that purpose first. */
async function issueToken(
  client: Prisma.TransactionClient,
  userId: string,
  purpose: "invite" | SignInTokenPurpose,
  ttlMs: number,
): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await client.authToken.updateMany({
    where: { userId, purpose, usedAt: null },
    data: { usedAt: new Date() },
  });
  await client.authToken.create({
    data: { userId, purpose, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + ttlMs) },
  });
  return raw;
}

/**
 * The one-time tokens the API mints (`auth_tokens`): invitations (feature 5.2), and for AMPM's own
 * sign-in (D-142) the challenge between password and authenticator code and the password-reset link.
 * Each is single-use, expiring and delivered out of band. Only the token's sha256 hash is ever stored.
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
    return issueInviteToken(client, userId);
  }

  /** Mints a sign-in challenge or a password-reset token (D-142); the RAW token goes to the user. */
  async issueSignInToken(
    userId: string,
    purpose: SignInTokenPurpose,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<string> {
    return issueToken(client, userId, purpose, SIGN_IN_TOKEN_TTL_MS[purpose]);
  }

  /** The unused, unexpired sign-in challenge or reset token matching this raw token, or null. */
  async findLiveSignInToken(raw: string, purpose: SignInTokenPurpose): Promise<LiveToken | null> {
    return this.prisma.authToken.findFirst({
      where: { purpose, tokenHash: hashToken(raw), usedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, userId: true, attempts: true },
    });
  }

  /**
   * Stores a client's new one-time sign-in code (D-147) by its HMAC (`hashOneTimeCode`), retiring their
   * still-live one first, so only the newest code works.
   */
  async issueOneTimeCode(userId: string, codeHash: string, ttlMs: number): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.authToken.updateMany({
        where: { userId, purpose: "otp", usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.authToken.create({
        data: {
          userId,
          purpose: "otp",
          tokenHash: codeHash,
          expiresAt: new Date(Date.now() + ttlMs),
        },
      }),
    ]);
  }

  /**
   * Reserves one try at a client's code before it is compared (D-147 review): an atomic increment that
   * only succeeds while the code is live and under CHALLENGE_MAX_ATTEMPTS tries, so guesses sent at once
   * cannot compare more than five times between them. False when the code is used, burned or expired.
   */
  async claimAttempt(id: string): Promise<boolean> {
    const claimed = await this.prisma.authToken.updateMany({
      where: {
        id,
        usedAt: null,
        attempts: { lt: CHALLENGE_MAX_ATTEMPTS },
        expiresAt: { gt: new Date() },
      },
      data: { attempts: { increment: 1 } },
    });
    return claimed.count === 1;
  }

  /** Burns a code whose last try was just spent on a wrong answer. */
  async burnIfSpent(id: string): Promise<void> {
    await this.prisma.authToken.updateMany({
      where: { id, usedAt: null, attempts: { gte: CHALLENGE_MAX_ATTEMPTS } },
      data: { usedAt: new Date() },
    });
  }

  /** The client's live one-time code (unused and unexpired; at most one), or null. */
  async findLiveOneTimeCode(userId: string): Promise<LiveCode | null> {
    return this.prisma.authToken.findFirst({
      where: { userId, purpose: "otp", usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, tokenHash: true, attempts: true },
    });
  }

  /**
   * Counts a wrong answer against a token; at CHALLENGE_MAX_ATTEMPTS it is burned (used), so guessing a
   * code means starting again from the password, which counts toward the account's lockout too.
   */
  async countWrongAnswer(id: string): Promise<void> {
    const token = await this.prisma.authToken.update({
      where: { id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    if (token.attempts >= CHALLENGE_MAX_ATTEMPTS) {
      await this.prisma.authToken.updateMany({
        where: { id, usedAt: null },
        data: { usedAt: new Date() },
      });
    }
  }

  /**
   * Retires a user's live sign-in challenges and reset links (D-142 security review): a password reset or
   * an administrator's reset must also cancel a sign-in already past the old password, which would
   * otherwise finish within its five minutes and open a session after every session was revoked.
   */
  async retireSignInTokens(
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.authToken.updateMany({
      where: { userId, purpose: { in: ["sign_in_challenge", "password_reset"] }, usedAt: null },
      data: { usedAt: new Date() },
    });
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

  /**
   * Retires every live invite for a user, so one can no longer be redeemed — e.g. when a client login
   * is removed before activation, which must not leave the invitee able to activate into a membership-
   * less account.
   */
  async invalidateInvitesFor(
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.authToken.updateMany({
      where: { userId, purpose: "invite", usedAt: null },
      data: { usedAt: new Date() },
    });
  }
}
