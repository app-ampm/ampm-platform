import { Inject, Injectable } from "@nestjs/common";

import { AppLogger } from "../../../common/logger.service.js";
import { ENV, type Env } from "../../../env.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { AuthTokenService } from "../../../identity/auth-token.service.js";
import { ClientUserService } from "../../../identity/client-user.service.js";
import {
  IDENTITY_PROVISIONER,
  type IdentityProvisioner,
} from "../../../identity/identity.types.js";
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
 * login without a token. After commit, the sign-in account is provisioned (cognito-setup §6; a no-op
 * under IDENTITY_PROVIDER=local) and the email goes out — both best-effort and outside the transaction
 * (an AWS call must not hold a DB transaction open), so a failure never undoes the login: the token is
 * saved and the invite can be re-sent, which re-provisions idempotently.
 */
@Injectable()
export class AccountInviteService {
  constructor(
    private readonly clientUsers: ClientUserService,
    private readonly authTokens: AuthTokenService,
    private readonly notifications: NotificationService,
    private readonly logger: AppLogger,
    @Inject(IDENTITY_PROVISIONER) private readonly provisioner: IdentityProvisioner,
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

  /** After commit: provision the sign-in account, then deliver the invite. `false` = not delivered. */
  async send(invitee: Invitee, minted: MintedInvite): Promise<boolean> {
    await this.provisioner
      .provisionUser({ kind: "client", email: invitee.email, phone: invitee.phone })
      .catch((error: unknown) =>
        this.logger.warn("account.invite.provision_failed", {
          userId: minted.userId,
          error: String(error),
        }),
      );
    return this.deliver(minted.userId, invitee.name, minted.inviteToken);
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
          activationUrl: `${this.env.WEB_APP_URL}/activate?token=${encodeURIComponent(inviteToken)}`,
        },
      });
      return result.suppressed === false;
    } catch {
      return false;
    }
  }
}
