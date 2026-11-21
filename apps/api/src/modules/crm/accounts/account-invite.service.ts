import { Inject, Injectable } from "@nestjs/common";
import { errors } from "@ampm/core";

import { ENV, type Env } from "../../../env.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { AuthTokenService } from "../../../identity/auth-token.service.js";
import { ClientUserService } from "../../../identity/client-user.service.js";
import { assertDevBuild } from "../../../identity/dev-gate.js";
import { NotificationService } from "../../admin/notification/notification.service.js";

/** The person a portal invite is for: an account contact who has an email. */
export interface Invitee {
  readonly name: string;
  readonly email: string;
  readonly phone: string | null;
  readonly actorId: string;
}

/** A login minted in a transaction, ready to be sent once that transaction commits. */
export interface MintedInvite {
  readonly userId: string;
  readonly inviteToken: string;
}

/**
 * A client account's portal invite (AUTH-02), shared by Convert (the primary contact) and the account
 * hub (any later contact, TW-13 "Invite portal user"). The `users` row and its invite token are minted
 * through the kernel identity services inside the caller's transaction, so a contact never points at a
 * login without a token. After commit the email goes out, best-effort and outside the transaction, so a
 * failure never undoes the login: the token is saved and the invite can be re-sent.
 */
@Injectable()
export class AccountInviteService {
  constructor(
    private readonly clientUsers: ClientUserService,
    private readonly authTokens: AuthTokenService,
    private readonly notifications: NotificationService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Create the invited client login and its invite token in `tx`. A duplicate email is a 409. */
  async mint(invitee: Invitee, tx: Prisma.TransactionClient): Promise<MintedInvite> {
    const { userId } = await this.clientUsers.provisionInvitedClient(
      {
        name: invitee.name,
        email: invitee.email,
        phone: invitee.phone,
        createdBy: invitee.actorId,
      },
      tx,
    );
    const inviteToken = await this.authTokens.issueInvite(userId, tx);
    return { userId, inviteToken };
  }

  /** After commit: deliver the invite. `false` = not delivered. */
  send(invitee: Invitee, minted: MintedInvite): Promise<boolean> {
    return this.deliver(minted.userId, invitee.name, minted.inviteToken);
  }

  /**
   * Invite links are served on test builds only (the dev sign-in gate): a 404 elsewhere. A caller runs
   * this before any lookup, so a production request learns nothing about the records it names.
   */
  assertLinksServed(): void {
    assertDevBuild(this.env);
  }

  /**
   * A fresh activation link for a login that is still `invited`, for staff to hand over on a test build,
   * which has no real email provider to deliver it. Issuing retires the login's earlier links, in the
   * caller's transaction (which audits it).
   */
  async reissueLink(userId: string, tx: Prisma.TransactionClient): Promise<string> {
    this.assertLinksServed();
    const status = await this.clientUsers.statusOf(userId, tx);
    if (status === "active") {
      throw errors.conflict("This contact has already activated their portal login");
    }
    if (status !== "invited") {
      throw errors.conflict("This contact's portal login is disabled, so it cannot be activated");
    }
    return this.activationUrl(await this.authTokens.issueInvite(userId, tx));
  }

  private activationUrl(inviteToken: string): string {
    return `${this.env.WEB_APP_URL}/activate?token=${encodeURIComponent(inviteToken)}`;
  }

  private async deliver(userId: string, name: string, inviteToken: string): Promise<boolean> {
    try {
      const result = await this.notifications.queue({
        recipientType: "user",
        recipientId: userId,
        channel: "email",
        eventType: "client.invited",
        templateKey: "client.invite",
        entityType: "user",
        entityId: userId,
        variables: {
          name,
          activationUrl: this.activationUrl(inviteToken),
        },
      });
      return result.suppressed === false;
    } catch {
      return false;
    }
  }
}
