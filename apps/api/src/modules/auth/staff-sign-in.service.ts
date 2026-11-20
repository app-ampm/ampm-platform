import { Inject, Injectable } from "@nestjs/common";
import {
  errors,
  SIGN_IN_ERRORS,
  type Acknowledged,
  type EnrolledGrant,
  type SignInCodeRequest,
  type SignInEnrolRequest,
  type SignInGrant,
  type SignInRequest,
  type SignInResponse,
  type TotpEnrolment,
} from "@ampm/core";

import { AppLogger } from "../../common/logger.service.js";
import { requestContext } from "../../common/request-context.js";
import { PrismaService } from "../../db/prisma.service.js";
import { AuthTokenService, type LiveToken } from "../../identity/auth-token.service.js";
import { verifyAgainstDummy, verifyPassword } from "../../identity/password-hasher.js";
import { generateRecoveryCodes, hashRecoveryCode } from "../../identity/recovery-codes.js";
import { SIGN_IN_KEYS, type SignInKeys } from "../../identity/sign-in-keys.js";
import { generateTotpSecret, matchTotp, totpUri } from "../../identity/totp.js";
import { AuditService } from "../../policy/audit.service.js";
import { SessionService } from "../../policy/session.service.js";
import { CredentialsRepository, type CredentialRecord } from "./credentials.repository.js";
import { SignInGrants } from "./sign-in-grant.js";

/** An account that may sign in now: active, and not paused by the lockout. */
function canSignIn(user: CredentialRecord, now: Date): boolean {
  return user.status === "active" && (!user.lockedUntil || user.lockedUntil <= now);
}

/**
 * AMPM's own staff sign-in (D-142, R10): the password first, then the authenticator code (or a single-use
 * recovery code) against a five-minute challenge. Every refusal before the code is the same message, so
 * the answers never reveal which emails have accounts; ten failures in a row pause the account for 15
 * minutes, and a challenge burns after five wrong codes. The routes do not exist under Cognito (404).
 */
@Injectable()
export class StaffSignInService {
  constructor(
    @Inject(SIGN_IN_KEYS) private readonly keys: SignInKeys | null,
    private readonly credentials: CredentialsRepository,
    private readonly tokens: AuthTokenService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
    private readonly grants: SignInGrants,
    private readonly logger: AppLogger,
  ) {}

  /** Step one: the email and password. Answers with the challenge for the code, or for enrolment. */
  async signIn(request: SignInRequest, now: Date = new Date()): Promise<SignInResponse> {
    const keys = this.signer();
    const user = await this.credentials.findStaffByEmail(request.email);
    if (!user || !canSignIn(user, now) || !user.passwordHash) {
      await verifyAgainstDummy(request.password);
      throw errors.unauthenticated(SIGN_IN_ERRORS.invalidCredentials);
    }
    if (!(await verifyPassword(request.password, user.passwordHash))) {
      await this.credentials.recordFailure(user.id, now);
      this.logger.warn("auth.sign_in_failed", { userId: user.id, reason: "password" });
      throw errors.unauthenticated(SIGN_IN_ERRORS.invalidCredentials);
    }
    const challenge = await this.tokens.issueSignInToken(user.id, "sign_in_challenge");
    if (user.totpSecretEnc) return { kind: "totp", challenge };
    // No confirmed authenticator (an administrator reset it): add one before any session is granted.
    return { kind: "enrol", challenge, enrolment: await this.beginEnrolment(keys, user) };
  }

  /** Step two: the authenticator code or a recovery code. Grants the session. */
  async verifyCode(request: SignInCodeRequest, now: Date = new Date()): Promise<SignInGrant> {
    const keys = this.signer();
    const { token, user } = await this.openChallenge(request.challenge, now);
    if (!user.totpSecretEnc) throw errors.unauthenticated(SIGN_IN_ERRORS.challengeExpired);
    const accepted = request.code
      ? await this.acceptCode(keys, user, user.totpSecretEnc, request.code, now)
      : await this.credentials.spendRecoveryCode(
          user.id,
          hashRecoveryCode(request.recoveryCode ?? ""),
          now,
        );
    if (!accepted) return this.refuseCode(token, user, now);
    await this.consume(token);
    await this.credentials.recordSuccess(user.id, now);
    return this.grants.grant(user, now);
  }

  /** Step two after a reset: confirm the new authenticator with its first code; new recovery codes too. */
  async confirmEnrolment(
    request: SignInEnrolRequest,
    now: Date = new Date(),
  ): Promise<EnrolledGrant> {
    const keys = this.signer();
    const { token, user } = await this.openChallenge(request.challenge, now);
    const pending = user.totpPendingEnc;
    if (user.totpSecretEnc || !pending)
      throw errors.unauthenticated(SIGN_IN_ERRORS.challengeExpired);
    const step = matchTotp(keys.box.open(pending), request.code, now, null);
    if (step === null) return this.refuseCode(token, user, now);
    await this.consume(token);
    const recoveryCodes = generateRecoveryCodes();
    await this.prisma.$transaction(async (tx) => {
      await this.credentials.confirmAuthenticator(tx, {
        userId: user.id,
        secretEnc: pending,
        step,
        codeHashes: recoveryCodes.map(hashRecoveryCode),
        now,
      });
      await this.audit.record(
        {
          action: "update",
          entityType: "user",
          entityId: user.id,
          after: { authenticator: "enrolled" },
        },
        tx,
      );
    });
    await this.credentials.recordSuccess(user.id, now);
    return { ...(await this.grants.grant(user, now)), recoveryCodes };
  }

  /** Ends the caller's own session (the token they signed in with). */
  async signOut(now: Date = new Date()): Promise<Acknowledged> {
    const tokenId = requestContext.get()?.tokenId;
    if (tokenId) await this.sessions.revokeToken(tokenId, "signed_out", now);
    return { ok: true };
  }

  private signer(): SignInKeys {
    if (!this.keys) throw errors.notFound();
    return this.keys;
  }

  private async openChallenge(
    raw: string,
    now: Date,
  ): Promise<{ token: LiveToken; user: CredentialRecord }> {
    const token = await this.tokens.findLiveSignInToken(raw, "sign_in_challenge");
    const user = token ? await this.credentials.findById(token.userId) : null;
    if (!token || !user || user.userType !== "staff" || !canSignIn(user, now)) {
      throw errors.unauthenticated(SIGN_IN_ERRORS.challengeExpired);
    }
    return { token, user };
  }

  /** A code matches and claims its time step, so the same code cannot be used twice. */
  private async acceptCode(
    keys: SignInKeys,
    user: CredentialRecord,
    secretEnc: string,
    code: string,
    now: Date,
  ): Promise<boolean> {
    const step = matchTotp(keys.box.open(secretEnc), code, now, user.totpLastStep);
    return step !== null && (await this.credentials.claimStep(user.id, step));
  }

  private async refuseCode(token: LiveToken, user: CredentialRecord, now: Date): Promise<never> {
    await this.tokens.countWrongAnswer(token.id);
    await this.credentials.recordFailure(user.id, now);
    this.logger.warn("auth.sign_in_failed", { userId: user.id, reason: "code" });
    throw errors.unauthenticated(SIGN_IN_ERRORS.invalidCode);
  }

  /** The challenge works once: a replay or a double submit finds it spent. */
  private async consume(token: LiveToken): Promise<void> {
    if (!(await this.tokens.markUsedIfLive(token.id))) {
      throw errors.unauthenticated(SIGN_IN_ERRORS.challengeExpired);
    }
  }

  private async beginEnrolment(keys: SignInKeys, user: CredentialRecord): Promise<TotpEnrolment> {
    const secret = generateTotpSecret();
    await this.credentials.savePending(user.id, keys.box.seal(secret));
    return { secret, otpauthUri: totpUri(user.email, secret) };
  }
}
