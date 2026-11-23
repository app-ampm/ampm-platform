import { Inject, Injectable } from "@nestjs/common";
import { ACTIVATION_ERRORS, errors, type ActivateResponse } from "@ampm/core";

import { PrismaService } from "../db/prisma.service.js";
import { ENV, type Env } from "../env.js";
import { Prisma } from "../generated/prisma/client.js";
import { AuditService } from "../policy/audit.service.js";
import { AuthTokenService } from "./auth-token.service.js";
import { assertDevBuild } from "./dev-gate.js";
import { IDENTITY_ADAPTER, type IdentityAdapter } from "./identity.types.js";

/**
 * Activation (D-041, "link on activate"). The caller proves both that AMPM invited them (the invite
 * token) and that they control a provider account (a verified access token); the API then binds
 * `identity_subject` and flips the account `invited → active`. No self-registration (A-13): without a
 * live invite there is nothing to activate.
 *
 * Development provider only (D-162): AMPM's own sign-in activates staff through the password and
 * authenticator routes and clients through the mobile code. The route is public, so no session check
 * runs, and a token whose session an administrator's reset revoked still verifies; outside a dev build
 * that let it activate a reset account with no password and no authenticator. There it is a 404.
 */
@Injectable()
export class ActivationService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(IDENTITY_ADAPTER) private readonly identity: IdentityAdapter,
    private readonly tokens: AuthTokenService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** `accessToken` is the request's Bearer, or null when it carried none. */
  async activate(inviteToken: string, accessToken: string | null): Promise<ActivateResponse> {
    assertDevBuild(this.env); // a 404 before anything is read: denial equals absence (security.md)
    if (!accessToken) {
      throw errors.unauthenticated("A provider access token is required to activate");
    }
    const verified = await this.identity.verifyAccessToken(accessToken); // throws unauthenticated
    const invite = await this.tokens.findValidInvite(inviteToken);
    if (!invite) throw errors.unauthenticated(ACTIVATION_ERRORS.invalidInvite);
    const user = await this.prisma.user.findFirst({
      where: { id: invite.userId, deletedAt: null },
      select: { id: true, email: true, status: true },
    });
    if (!user) throw errors.unauthenticated(ACTIVATION_ERRORS.invalidInvite);
    if (user.status !== "invited") throw errors.conflict(ACTIVATION_ERRORS.alreadyActive);
    // The provider's verified email MUST be present and match the invitation — otherwise mere
    // possession of a leaked invite token would let any provider account be linked to this user.
    // Fail closed when the provider gives no email (the identity provider must put a verified email
    // on the access token it issues for activation).
    if (!verified.email || verified.email.toLowerCase() !== user.email.toLowerCase()) {
      throw errors.forbidden("The sign-in email must match the invitation");
    }
    const linkedElsewhere = await this.prisma.user.findFirst({
      where: { identitySubject: verified.subject, NOT: { id: user.id } },
      select: { id: true },
    });
    if (linkedElsewhere) {
      throw errors.conflict("That sign-in is already linked to another account");
    }

    await this.bindAndActivate(user.id, invite.id, verified.subject);
    return { userId: user.id, status: "active" };
  }

  /**
   * In one transaction: claim the invite (atomic single-use), link the subject, activate, and audit.
   * Claiming first means a concurrent activation of the same token is refused; a subject already
   * linked elsewhere is caught by the unique column and mapped to a 409.
   */
  private async bindAndActivate(userId: string, inviteId: string, subject: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        if (!(await this.tokens.markUsedIfLive(inviteId, tx))) {
          throw errors.conflict(ACTIVATION_ERRORS.inviteUsed);
        }
        await tx.user.update({
          where: { id: userId },
          data: { identitySubject: subject, status: "active" },
        });
        // A client activating accepts their wedding: flip their invited membership(s) to active with
        // accepted_at, or the activated client reaches no project — the principal loads active
        // memberships only, so recordScope would yield `projectId in []` on every project query (B1).
        // Staff have no such membership yet (module E), so this is a no-op for them.
        await tx.projectMember.updateMany({
          where: { userId, status: "invited", deletedAt: null },
          data: { status: "active", acceptedAt: new Date() },
        });
        await this.audit.record(
          {
            action: "update",
            entityType: "user",
            entityId: userId,
            before: { status: "invited" },
            after: { status: "active" },
            maskImages: false,
          },
          tx,
        );
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw errors.conflict("That sign-in is already linked to another account");
      }
      throw error;
    }
  }
}
