import { Injectable } from "@nestjs/common";
import { errors, type StaffUserView } from "@ampm/core";

import { PrismaService } from "../../../db/prisma.service.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { AuditService } from "../../../policy/audit.service.js";
import { SessionService } from "../../../policy/session.service.js";
import { StaffUsersService } from "./staff-users.service.js";

/** The authenticator columns of a staff account (D-142); queries only. */
@Injectable()
export class StaffAuthenticatorRepository {
  /** No authenticator and no recovery codes: the next sign-in asks the person to add a new one. */
  async clear(tx: Prisma.TransactionClient, userId: string): Promise<void> {
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

/**
 * An administrator resets a staff member's authenticator (D-142): for a lost or replaced phone, or a
 * suspected compromise. The authenticator and every recovery code are cleared and every session is
 * signed out; at the next sign-in the password is still required, then the person adds a new
 * authenticator before any session is granted. Audited.
 *
 *   await this.authenticators.reset(userId); // the refreshed StaffUserView
 */
@Injectable()
export class StaffAuthenticatorService {
  constructor(
    private readonly repository: StaffAuthenticatorRepository,
    private readonly users: StaffUsersService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
  ) {}

  async reset(id: string): Promise<StaffUserView> {
    const user = await this.users.get(id);
    if (user.status !== "active") {
      throw errors.conflict("Only an active account has an authenticator to reset");
    }
    await this.prisma.$transaction(async (tx) => {
      await this.repository.clear(tx, id);
      await this.audit.record(
        { action: "update", entityType: "user", entityId: id, after: { authenticator: "reset" } },
        tx,
      );
    });
    await this.sessions.revokeAllForUser(id, "authenticator_reset");
    return this.users.get(id);
  }
}
