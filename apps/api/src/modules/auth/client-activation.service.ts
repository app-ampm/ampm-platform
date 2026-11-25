import { Injectable } from "@nestjs/common";
import {
  ACTIVATION_ERRORS,
  errors,
  maskPhone,
  SIGN_IN_ERRORS,
  type ClientActivationCodeSent,
  type ClientActivationConfirmRequest,
  type InvitationTokenRequest,
  type SignInGrant,
} from "@ampm/core";

import { PrismaService } from "../../db/prisma.service.js";
import { AuthTokenService, type ValidInvite } from "../../identity/auth-token.service.js";
import { AuditService } from "../../policy/audit.service.js";
import { ClientCodes } from "./client-codes.service.js";
import { CredentialsRepository, type CredentialRecord } from "./credentials.repository.js";
import { CLIENT_TOKEN_TTL, SignInGrants } from "./sign-in-grant.js";

/**
 * Activating an invited client (D-147): the invitation link sends a one-time code to the mobile AMPM has
 * on file, and the code turns the account active and signs the client in. No password, no
 * authenticator: the mobile is the client's credential. Staff invitations keep their own activation
 * (password and authenticator, D-142).
 */
@Injectable()
export class ClientActivationService {
  constructor(
    private readonly codes: ClientCodes,
    private readonly tokens: AuthTokenService,
    private readonly credentials: CredentialsRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly grants: SignInGrants,
  ) {}

  /** Sends the activation code to the invited client's mobile, which the answer shows masked. */
  async sendCode(request: InvitationTokenRequest): Promise<ClientActivationCodeSent> {
    const { user } = await this.invitedClient(request.token);
    const phone = await this.usableMobile(user);
    await this.codes.allow(phone);
    return { ...(await this.codes.send(user)), maskedPhone: maskPhone(phone) };
  }

  /** Spends the code and the invitation, activates the account and starts its session. */
  async confirm(
    request: ClientActivationConfirmRequest,
    now: Date = new Date(),
  ): Promise<SignInGrant> {
    const { invite, user } = await this.invitedClient(request.token);
    await this.usableMobile(user);
    await this.codes.verify(user.id, request.code);
    const identitySubject = user.identitySubject ?? `ampm:${user.id}`;
    await this.activate(invite, user, identitySubject);
    return this.grants.grant({ ...user, identitySubject }, now, CLIENT_TOKEN_TTL);
  }

  /**
   * The invited client's mobile, refusing when there is none or another active client already has it:
   * a shared number would match no one at sign-in and lock both out.
   */
  private async usableMobile(user: CredentialRecord): Promise<string> {
    if (!user.phone) throw errors.conflict(SIGN_IN_ERRORS.noMobileOnFile);
    if ((await this.credentials.countOtherActiveClients(user.phone, user.id)) > 0) {
      throw errors.conflict(SIGN_IN_ERRORS.mobileInUse);
    }
    return user.phone;
  }

  /** The live invitation and its still-invited client account, or the refusals the screen knows. */
  private async invitedClient(
    raw: string,
  ): Promise<{ invite: ValidInvite; user: CredentialRecord }> {
    const invite = await this.tokens.findValidInvite(raw);
    const user = invite ? await this.credentials.findById(invite.userId) : null;
    if (!invite || !user) throw errors.unauthenticated(ACTIVATION_ERRORS.invalidInvite);
    if (user.status !== "invited") throw errors.conflict(ACTIVATION_ERRORS.alreadyActive);
    if (user.userType !== "client") {
      const message = "Staff accounts are activated with a password and an authenticator";
      throw errors.validation([{ path: "token", message }], message);
    }
    return { invite, user };
  }

  /** In one transaction: spend the invitation, activate the account, audit. */
  private async activate(
    invite: ValidInvite,
    user: CredentialRecord,
    identitySubject: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (!(await this.tokens.markUsedIfLive(invite.id, tx))) {
        throw errors.conflict(ACTIVATION_ERRORS.inviteUsed);
      }
      await tx.user.update({
        where: { id: user.id },
        data: { identitySubject, status: "active" },
      });
      await this.audit.record(
        {
          action: "update",
          entityType: "user",
          entityId: user.id,
          before: { status: "invited" },
          after: { status: "active", via: "client_code" },
        },
        tx,
      );
    });
  }
}
