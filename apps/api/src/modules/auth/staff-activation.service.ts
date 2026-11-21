import { Inject, Injectable } from "@nestjs/common";
import {
  ACTIVATION_ERRORS,
  errors,
  SIGN_IN_ERRORS,
  type ActivationConfirmRequest,
  type ActivationPasswordRequest,
  type ActivationPasswordResponse,
  type EnrolledGrant,
  type InvitationPreview,
} from "@ampm/core";

import { PrismaService } from "../../db/prisma.service.js";
import { AuthTokenService, type ValidInvite } from "../../identity/auth-token.service.js";
import { hashPassword } from "../../identity/password-hasher.js";
import { generateRecoveryCodes, hashRecoveryCode } from "../../identity/recovery-codes.js";
import { SIGN_IN_KEYS, type SignInKeys } from "../../identity/sign-in-keys.js";
import { generateTotpSecret, matchTotp, totpUri } from "../../identity/totp.js";
import { AuditService } from "../../policy/audit.service.js";
import { CredentialsRepository, type CredentialRecord } from "./credentials.repository.js";
import { SignInGrants } from "./sign-in-grant.js";

/** The refusal when a password repeats the account's own email address. */
const PASSWORD_IS_EMAIL = "Choose a password that is not your email address";

/**
 * Activating an invitation with AMPM's own sign-in (D-142): the invited staff member chooses a password,
 * adds the authenticator shown as a QR code, and confirms it with its first code. Only then does the
 * account turn active, its identity subject become `ampm:<id>`, the invitation get spent, and the
 * session and the ten recovery codes come back. No self-registration (A-13): it needs AMPM's invitation.
 * Client accounts activate with a mobile code, which arrives with the SMS provider (not yet).
 */
@Injectable()
export class StaffActivationService {
  constructor(
    @Inject(SIGN_IN_KEYS) private readonly keys: SignInKeys,
    private readonly credentials: CredentialsRepository,
    private readonly tokens: AuthTokenService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly grants: SignInGrants,
  ) {}

  /** Who the invitation is for, so the screen can greet them. Changes nothing. */
  async preview(raw: string): Promise<InvitationPreview> {
    const { user } = await this.invited(raw);
    return {
      name: user.name,
      email: user.email,
      userType: user.userType === "staff" ? "staff" : "client",
    };
  }

  /** Step one: the password, and an authenticator secret to add. The account stays `invited`. */
  async setPassword(request: ActivationPasswordRequest): Promise<ActivationPasswordResponse> {
    const { user } = await this.invited(request.token);
    if (user.userType !== "staff") {
      throw errors.validation([
        { path: "token", message: SIGN_IN_ERRORS.clientActivationUnavailable },
      ]);
    }
    if (request.password.trim().toLowerCase() === user.email.toLowerCase()) {
      throw errors.validation(
        [{ path: "password", message: PASSWORD_IS_EMAIL }],
        PASSWORD_IS_EMAIL,
      );
    }
    const passwordHash = await hashPassword(request.password);
    const secret = generateTotpSecret();
    await this.prisma.$transaction(async (tx) => {
      await this.credentials.savePassword(user.id, passwordHash, new Date(), tx);
      await this.credentials.savePending(user.id, this.keys.box.seal(secret), tx);
    });
    return { enrolment: { secret, otpauthUri: totpUri(user.email, secret) } };
  }

  /** Step two: the first authenticator code. Activates the account and signs it in. */
  async confirm(request: ActivationConfirmRequest, now: Date = new Date()): Promise<EnrolledGrant> {
    const { invite, user } = await this.invited(request.token);
    const pending = user.totpPendingEnc;
    if (user.userType !== "staff" || !user.passwordHash || !pending) {
      throw errors.conflict("Choose a password first");
    }
    const step = matchTotp(this.keys.box.open(pending), request.code, now, null);
    if (step === null) throw errors.unauthenticated(SIGN_IN_ERRORS.invalidCode);
    const recoveryCodes = generateRecoveryCodes();
    const identitySubject = user.identitySubject ?? `ampm:${user.id}`;
    const recoveryKey = this.keys.recoveryKey;
    await this.activate({
      invite,
      user,
      pending,
      step,
      identitySubject,
      recoveryCodes,
      recoveryKey,
      now,
    });
    await this.credentials.recordSuccess(user.id, now);
    return { ...(await this.grants.grant({ ...user, identitySubject }, now)), recoveryCodes };
  }

  /** The live invitation and its still-invited account, or the activation refusals the screen knows. */
  private async invited(raw: string): Promise<{ invite: ValidInvite; user: CredentialRecord }> {
    const invite = await this.tokens.findValidInvite(raw);
    const user = invite ? await this.credentials.findById(invite.userId) : null;
    if (!invite || !user) throw errors.unauthenticated(ACTIVATION_ERRORS.invalidInvite);
    if (user.status !== "invited") throw errors.conflict(ACTIVATION_ERRORS.alreadyActive);
    return { invite, user };
  }

  /** In one transaction: spend the invitation, confirm the authenticator, activate, audit. */
  private async activate(input: {
    invite: ValidInvite;
    user: CredentialRecord;
    pending: string;
    step: number;
    identitySubject: string;
    recoveryCodes: readonly string[];
    recoveryKey: Buffer;
    now: Date;
  }): Promise<void> {
    const { invite, user, now } = input;
    await this.prisma.$transaction(async (tx) => {
      if (!(await this.tokens.markUsedIfLive(invite.id, tx))) {
        throw errors.conflict(ACTIVATION_ERRORS.inviteUsed);
      }
      await this.credentials.confirmAuthenticator(tx, {
        userId: user.id,
        secretEnc: input.pending,
        step: input.step,
        codeHashes: input.recoveryCodes.map((code) => hashRecoveryCode(code, input.recoveryKey)),
        now,
      });
      await tx.user.update({
        where: { id: user.id },
        data: { identitySubject: input.identitySubject, status: "active" },
      });
      await this.audit.record(
        {
          action: "update",
          entityType: "user",
          entityId: user.id,
          before: { status: "invited" },
          after: { status: "active", via: "ampm_sign_in", authenticator: "enrolled" },
        },
        tx,
      );
    });
  }
}
