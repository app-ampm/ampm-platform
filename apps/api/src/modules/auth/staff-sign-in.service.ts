import { createHash } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import {
  errors,
  SIGN_IN_ERRORS,
  type Acknowledged,
  type SignInCodeRequest,
  type SignInGrant,
  type SignInRequest,
  type SignInResponse,
} from "@ampm/core";

import { AppLogger } from "../../common/logger.service.js";
import { clientKey } from "../../common/rate-limit/client-key.js";
import { RateLimitStore } from "../../common/rate-limit/rate-limit.store.js";
import { requestContext } from "../../common/request-context.js";
import { AuthTokenService, type LiveToken } from "../../identity/auth-token.service.js";
import { verifyAgainstDummy, verifyPassword } from "../../identity/password-hasher.js";
import { hashRecoveryCode } from "../../identity/recovery-codes.js";
import { SIGN_IN_KEYS, type SignInKeys } from "../../identity/sign-in-keys.js";
import { matchTotp } from "../../identity/totp.js";
import { AuditService } from "../../policy/audit.service.js";
import { SessionService } from "../../policy/session.service.js";
import { CredentialsRepository, type CredentialRecord } from "./credentials.repository.js";
import { SignInGrants } from "./sign-in-grant.js";

/** Password tries per email from one client network before that pair pauses (D-142). */
const PASSWORD_TRIES = 10;
const PASSWORD_WINDOW_MS = 15 * 60 * 1000;

/** An account that can sign in: active, with a password and a confirmed authenticator. */
type SignInAccount = CredentialRecord & { passwordHash: string; totpSecretEnc: string };

function canSignIn(user: CredentialRecord): user is SignInAccount {
  return user.status === "active" && Boolean(user.passwordHash) && Boolean(user.totpSecretEnc);
}

/**
 * AMPM's own staff sign-in (D-142, R10): the password, then the authenticator code (or a single-use
 * recovery code) against a five-minute challenge.
 * - Every refusal before the code is the same message, so the answers never reveal which emails exist.
 * - Passwords are throttled per email and client network (an IPv6 /64): one attacker cannot lock a
 *   person out, and a burst cannot outrun the count, which is one atomic increment.
 * - An account without a confirmed authenticator cannot sign in at all; its holder activates from an
 *   invitation, which sets both (an administrator's reset re-invites).
 * - A challenge burns after five wrong codes, and twenty wrong codes in a row lock the account for an
 *   administrator, whatever resets happen in between.
 * The routes do not exist under Cognito (404).
 */
@Injectable()
export class StaffSignInService {
  constructor(
    @Inject(SIGN_IN_KEYS) private readonly keys: SignInKeys | null,
    private readonly credentials: CredentialsRepository,
    private readonly tokens: AuthTokenService,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
    private readonly grants: SignInGrants,
    private readonly throttle: RateLimitStore,
    private readonly logger: AppLogger,
  ) {}

  /** Step one: the email and password. Answers with the challenge for the authenticator code. */
  async signIn(request: SignInRequest): Promise<SignInResponse> {
    this.signer();
    if (!(await this.withinPasswordTries(request.email))) {
      throw errors.unauthenticated(SIGN_IN_ERRORS.invalidCredentials);
    }
    const user = await this.credentials.findStaffByEmail(request.email);
    if (!user || !canSignIn(user)) {
      await verifyAgainstDummy(request.password);
      throw errors.unauthenticated(SIGN_IN_ERRORS.invalidCredentials);
    }
    if (!(await verifyPassword(request.password, user.passwordHash))) {
      this.logger.warn("auth.sign_in_failed", { userId: user.id, reason: "password" });
      throw errors.unauthenticated(SIGN_IN_ERRORS.invalidCredentials);
    }
    const challenge = await this.tokens.issueSignInToken(user.id, "sign_in_challenge");
    return { kind: "totp", challenge };
  }

  /** Step two: the authenticator code or a recovery code. Grants the session. */
  async verifyCode(request: SignInCodeRequest, now: Date = new Date()): Promise<SignInGrant> {
    const keys = this.signer();
    const { token, user } = await this.openChallenge(request.challenge);
    const accepted = request.code
      ? await this.acceptCode(keys, user, request.code, now)
      : await this.credentials.spendRecoveryCode(
          user.id,
          hashRecoveryCode(request.recoveryCode ?? "", keys.recoveryKey),
          now,
        );
    if (!accepted) return this.refuseCode(token, user);
    if (!(await this.tokens.markUsedIfLive(token.id))) {
      throw errors.unauthenticated(SIGN_IN_ERRORS.challengeExpired);
    }
    await this.credentials.recordSuccess(user.id, now);
    return this.grants.grant(user, now);
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

  /**
   * One atomic increment per try, before any password is hashed: the same for an unknown email as for a
   * real one, keyed by a hash of the email so no address is stored. A broken store fails open (D-046):
   * the authenticator code and the code-failure lock still stand behind the password.
   */
  private async withinPasswordTries(email: string): Promise<boolean> {
    const emailKey = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
    const key = `auth:sign_in:${emailKey}:${clientKey(requestContext.get()?.ip)}`;
    try {
      return (await this.throttle.hit(key, PASSWORD_WINDOW_MS)).count <= PASSWORD_TRIES;
    } catch {
      this.logger.warn("auth.sign_in_throttle_unavailable", {});
      return true;
    }
  }

  private async openChallenge(raw: string): Promise<{ token: LiveToken; user: SignInAccount }> {
    const token = await this.tokens.findLiveSignInToken(raw, "sign_in_challenge");
    const user = token ? await this.credentials.findById(token.userId) : null;
    if (!token || !user || user.userType !== "staff" || !canSignIn(user)) {
      throw errors.unauthenticated(SIGN_IN_ERRORS.challengeExpired);
    }
    return { token, user };
  }

  /** A code matches and claims its time step, so the same code cannot be used twice. */
  private async acceptCode(
    keys: SignInKeys,
    user: SignInAccount,
    code: string,
    now: Date,
  ): Promise<boolean> {
    const step = matchTotp(keys.box.open(user.totpSecretEnc), code, now, user.totpLastStep);
    return step !== null && (await this.credentials.claimStep(user.id, step));
  }

  /** A wrong code: the challenge counts it, and so does the account, which locks at the ceiling. */
  private async refuseCode(token: LiveToken, user: CredentialRecord): Promise<never> {
    await this.tokens.countWrongAnswer(token.id);
    if (await this.credentials.recordCodeFailure(user.id)) {
      await this.sessions.revokeAllForUser(user.id, "too_many_wrong_codes");
      await this.audit.record({
        action: "update",
        entityType: "user",
        entityId: user.id,
        before: { status: "active" },
        after: { status: "locked", reason: "too_many_wrong_codes" },
      });
      this.logger.warn("auth.account_locked", { userId: user.id });
    }
    this.logger.warn("auth.sign_in_failed", { userId: user.id, reason: "code" });
    throw errors.unauthenticated(SIGN_IN_ERRORS.invalidCode);
  }
}
