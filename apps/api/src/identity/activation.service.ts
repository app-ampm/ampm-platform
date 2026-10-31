import { Inject, Injectable } from "@nestjs/common";
import { errors, type ActivateResponse } from "@ampm/core";

import { PrismaService } from "../db/prisma.service.js";
import { Prisma } from "../generated/prisma/client.js";
import { AuditService } from "../policy/audit.service.js";
import { AuthTokenService } from "./auth-token.service.js";
import { IDENTITY_ADAPTER, type IdentityAdapter } from "./identity.types.js";

/**
 * Activation (D-041, "link on activate"). The caller proves both that AMPM invited them (the invite
 * token) and that they control a provider account (a verified access token); the API then binds
 * `identity_subject` and flips the account `invited → active`. No self-registration (A-13): without a
 * live invite there is nothing to activate.
 */
@Injectable()
export class ActivationService {
  constructor(
    @Inject(IDENTITY_ADAPTER) private readonly identity: IdentityAdapter,
    private readonly tokens: AuthTokenService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async activate(inviteToken: string, accessToken: string): Promise<ActivateResponse> {
    const verified = await this.identity.verifyAccessToken(accessToken); // throws unauthenticated
    const invite = await this.tokens.findValidInvite(inviteToken);
    if (!invite) throw errors.unauthenticated("Invalid or expired invitation");
    const user = await this.prisma.user.findFirst({
      where: { id: invite.userId, deletedAt: null },
      select: { id: true, email: true, status: true },
    });
    if (!user) throw errors.unauthenticated("Invalid or expired invitation");
    if (user.status !== "invited") throw errors.conflict("This account is already activated");
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
          throw errors.conflict("This invitation has already been used");
        }
        await tx.user.update({
          where: { id: userId },
          data: { identitySubject: subject, status: "active" },
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
