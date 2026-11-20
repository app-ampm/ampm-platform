import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../db/prisma.service.js";
import type { Prisma } from "../../generated/prisma/client.js";

/**
 * Consecutive wrong authenticator or recovery codes before the account is locked for an administrator
 * (D-142). Each try already needs the right password, and only a correct code clears the count: a lock
 * expiry or a password reset never does, so guessing the six digits has a hard ceiling.
 */
export const MAX_FAILED_CODES = 20;

const CREDENTIALS = {
  id: true,
  name: true,
  email: true,
  phone: true,
  userType: true,
  status: true,
  identitySubject: true,
  passwordHash: true,
  totpSecretEnc: true,
  totpPendingEnc: true,
  totpLastStep: true,
  failedCodes: true,
} satisfies Prisma.UserSelect;

/** A staff account as the sign-in flows see it, credential columns included (SECRET, server-only). */
export type CredentialRecord = Prisma.UserGetPayload<{ select: typeof CREDENTIALS }>;

/**
 * The credential queries of AMPM's own sign-in (D-142): finding a staff account, the code-failure count,
 * the authenticator secret and the recovery codes. Queries only; the rules live in the services.
 */
@Injectable()
export class CredentialsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The staff account whose email equals this one, ignoring case, or null; never a deleted one. An exact
   * `lower()` comparison, not Prisma's case-insensitive `equals`, which compiles to ILIKE and would treat
   * `_` and `%` in the typed email as wildcards (D-142 security review). Ambiguity counts as no match.
   */
  async findStaffByEmail(email: string): Promise<CredentialRecord | null> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM users
      WHERE lower(email) = lower(${email.trim()}) AND user_type = 'staff' AND deleted_at IS NULL
      LIMIT 2`;
    const [only] = rows;
    return rows.length === 1 && only ? this.findById(only.id) : null;
  }

  /**
   * The active client account with exactly this mobile (E.164, as the request schema normalised it), or
   * null; never a deleted one (D-147). The number is not unique in the table, so two active clients
   * sharing it count as no match: a code then goes to nobody rather than to the wrong account.
   */
  async findActiveClientByPhone(phone: string): Promise<CredentialRecord | null> {
    const rows = await this.prisma.user.findMany({
      where: { phone, userType: "client", status: "active", deletedAt: null },
      select: CREDENTIALS,
      take: 2,
    });
    const [only] = rows;
    return rows.length === 1 && only ? only : null;
  }

  /**
   * How many OTHER active client accounts have this mobile. Activation refuses a number already in use:
   * a shared number matches no one at sign-in, so it would lock both clients out (D-147 review).
   */
  countOtherActiveClients(phone: string, exceptUserId: string): Promise<number> {
    return this.prisma.user.count({
      where: {
        phone,
        userType: "client",
        status: "active",
        deletedAt: null,
        NOT: { id: exceptUserId },
      },
    });
  }

  findById(id: string): Promise<CredentialRecord | null> {
    return this.prisma.user.findFirst({ where: { id, deletedAt: null }, select: CREDENTIALS });
  }

  /**
   * Counts a wrong code; the MAX_FAILED_CODES-th locks the account (status `locked`) for an administrator.
   * Returns whether this call locked it.
   */
  async recordCodeFailure(userId: string): Promise<boolean> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { failedCodes: { increment: 1 } },
      select: { failedCodes: true },
    });
    if (user.failedCodes < MAX_FAILED_CODES) return false;
    const locked = await this.prisma.user.updateMany({
      where: { id: userId, status: "active" },
      data: { status: "locked" },
    });
    return locked.count === 1;
  }

  /** A correct code: the failure count clears and the last-sign-in time is stamped. */
  async recordSuccess(userId: string, now: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { failedCodes: 0, lastLoginAt: now },
    });
  }

  /**
   * Claims a code's time step: true only when it is newer than the last accepted one, decided in one
   * conditional update, so two sign-ins racing with the same code cannot both succeed.
   */
  async claimStep(userId: string, step: number): Promise<boolean> {
    const claimed = await this.prisma.user.updateMany({
      where: { id: userId, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
      data: { totpLastStep: step },
    });
    return claimed.count === 1;
  }

  /** Stores an authenticator secret shown for enrolment and not yet confirmed. */
  async savePending(
    userId: string,
    pendingEnc: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.user.update({ where: { id: userId }, data: { totpPendingEnc: pendingEnc } });
  }

  /** Sets a new password hash (activation, or a reset). The code-failure count is left as it is. */
  async savePassword(
    userId: string,
    passwordHash: string,
    now: Date,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.user.update({
      where: { id: userId },
      data: { passwordHash, passwordChangedAt: now, totpPendingEnc: null },
    });
  }

  /**
   * Makes the pending secret the account's authenticator, remembers the step of the code that confirmed
   * it, clears the code-failure count, and replaces the recovery codes with the new set (their hashes).
   */
  async confirmAuthenticator(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      secretEnc: string;
      step: number;
      codeHashes: readonly string[];
      now: Date;
    },
  ): Promise<void> {
    await tx.user.update({
      where: { id: input.userId },
      data: {
        totpSecretEnc: input.secretEnc,
        totpPendingEnc: null,
        totpConfirmedAt: input.now,
        totpLastStep: input.step,
        failedCodes: 0,
        mfaEnabled: true,
      },
    });
    await tx.userRecoveryCode.deleteMany({ where: { userId: input.userId } });
    await tx.userRecoveryCode.createMany({
      data: input.codeHashes.map((codeHash) => ({ userId: input.userId, codeHash })),
    });
  }

  /** Spends one unused recovery code; true when this call spent it (a code works once). */
  async spendRecoveryCode(userId: string, codeHash: string, now: Date): Promise<boolean> {
    const spent = await this.prisma.userRecoveryCode.updateMany({
      where: { userId, codeHash, usedAt: null },
      data: { usedAt: now },
    });
    return spent.count === 1;
  }
}
