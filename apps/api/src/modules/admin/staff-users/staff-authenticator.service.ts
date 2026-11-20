import { Injectable } from "@nestjs/common";
import { errors, type StaffUserView } from "@ampm/core";

import { PrismaService } from "../../../db/prisma.service.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { AuthTokenService } from "../../../identity/auth-token.service.js";
import { AuditService } from "../../../policy/audit.service.js";
import { SessionService } from "../../../policy/session.service.js";
import { StaffUsersService } from "./staff-users.service.js";

/** The sign-in credentials of a staff account (D-142); queries only. */
@Injectable()
export class StaffAuthenticatorRepository {
  /**
   * Back to an invitation: no password, no authenticator, no recovery codes, a clean code-failure count,
   * and the `invited` status, so the account cannot sign in until its holder activates again.
   */
  async resetToInvited(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    await tx.user.update({
      where: { id: userId },
      data: {
        status: "invited",
        passwordHash: null,
        totpSecretEnc: null,
        totpPendingEnc: null,
        totpConfirmedAt: null,
        totpLastStep: null,
        failedCodes: 0,
      },
    });
    await tx.userRecoveryCode.deleteMany({ where: { userId } });
  }
}

/**
 * An administrator resets a staff member's sign-in (D-142): for a lost or replaced phone, a suspected
 * compromise, or an account locked after too many wrong codes. The password, the authenticator and every
 * recovery code are cleared, the account goes back to `invited`, any sign-in in progress is cancelled and
 * every session is signed out; a fresh invitation is emailed, from which the person sets a new password
 * and authenticator. No state remains in which a password or a mailbox alone opens the account (the
 * security review's high finding). Audited.
 *
 *   await this.authenticators.reset(userId); // the refreshed StaffUserView (status invited)
 */
@Injectable()
export class StaffAuthenticatorService {
  constructor(
    private readonly repository: StaffAuthenticatorRepository,
    private readonly users: StaffUsersService,
    private readonly tokens: AuthTokenService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
  ) {}

  async reset(id: string): Promise<StaffUserView> {
    const user = await this.users.get(id);
    if (user.status !== "active" && user.status !== "locked") {
      throw errors.conflict("Only an active or locked account has a sign-in to reset");
    }
    await this.prisma.$transaction(async (tx) => {
      await this.repository.resetToInvited(tx, id);
      await this.tokens.retireSignInTokens(id, tx);
      await this.audit.record(
        {
          action: "update",
          entityType: "user",
          entityId: id,
          before: { status: user.status },
          after: { status: "invited", authenticator: "reset", password: "cleared" },
        },
        tx,
      );
    });
    await this.sessions.revokeAllForUser(id, "authenticator_reset");
    // The existing re-invite path issues the new invitation and emails its link.
    return this.users.reinvite(id);
  }
}
