import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../db/prisma.service.js";
import type { Prisma } from "../../generated/prisma/client.js";

/** Wrong passwords or codes in a row before sign-in pauses for the account (D-142). */
export const MAX_FAILED_SIGN_INS = 10;
/** How long sign-in pauses after MAX_FAILED_SIGN_INS. */
export const LOCKOUT_MS = 15 * 60 * 1000;

const CREDENTIALS = {
  id: true,
  name: true,
  email: true,
  userType: true,
  status: true,
  identitySubject: true,
  passwordHash: true,
  totpSecretEnc: true,
  totpPendingEnc: true,
  totpLastStep: true,
  lockedUntil: true,
} satisfies Prisma.UserSelect;

/** A staff account as the sign-in flows see it, credential columns included (SECRET, server-only). */
export type CredentialRecord = Prisma.UserGetPayload<{ select: typeof CREDENTIALS }>;

/**
 * The credential queries of AMPM's own sign-in (D-142): finding a staff account, the lockout counters,
 * the authenticator secret and the recovery codes. Queries only; the rules live in the services.
 */
@Injectable()
export class CredentialsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The staff account with this email (case-insensitive), or null. Never a deleted one. */
  findStaffByEmail(email: string): Promise<CredentialRecord | null> {
    return this.prisma.user.findFirst({
      where: {
        email: { equals: email.trim(), mode: "insensitive" },
        userType: "staff",
        deletedAt: null,
      },
      select: CREDENTIALS,
    });
  }

  findById(id: string): Promise<CredentialRecord | null> {
    return this.prisma.user.findFirst({ where: { id, deletedAt: null }, select: CREDENTIALS });
  }

  /** Counts a failure; the MAX_FAILED_SIGN_INS-th pauses sign-in for LOCKOUT_MS and restarts the count. */
  async recordFailure(userId: string, now: Date): Promise<void> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { failedSignIns: { increment: 1 } },
      select: { failedSignIns: true },
    });
    if (user.failedSignIns < MAX_FAILED_SIGN_INS) return;
    await this.prisma.user.update({
      where: { id: userId },
      data: { failedSignIns: 0, lockedUntil: new Date(now.getTime() + LOCKOUT_MS) },
    });
  }

  /** A successful sign-in: the failure count clears and the last-sign-in time is stamped. */
  async recordSuccess(userId: string, now: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { failedSignIns: 0, lockedUntil: null, lastLoginAt: now },
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

  /** Sets a new password hash and clears the lockout (activation, or a reset). */
  async savePassword(
    userId: string,
    passwordHash: string,
    now: Date,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.user.update({
      where: { id: userId },
      data: { passwordHash, passwordChangedAt: now, failedSignIns: 0, lockedUntil: null },
    });
  }

  /**
   * Makes the pending secret the account's authenticator, remembers the step of the code that confirmed
   * it, and replaces the recovery codes with the new set (their hashes).
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

  /** An administrator's reset: no authenticator and no recovery codes until the person adds a new one. */
  async clearAuthenticator(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    await tx.user.update({
      where: { id: userId },
      data: {
        totpSecretEnc: null,
        totpPendingEnc: null,
        totpConfirmedAt: null,
        totpLastStep: null,
      },
    });
    await tx.userRecoveryCode.deleteMany({ where: { userId } });
  }
}
