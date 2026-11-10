import { Inject, Injectable } from "@nestjs/common";
import {
  errors,
  type ClientLoginCreateRequest,
  type ClientLoginList,
  type ClientLoginUpdateRequest,
  type ClientLoginView,
} from "@ampm/core";

import { AppLogger } from "../../../common/logger.service.js";
import { PrismaService } from "../../../db/prisma.service.js";
import { ENV, type Env } from "../../../env.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { AuthTokenService } from "../../../identity/auth-token.service.js";
import {
  IDENTITY_PROVISIONER,
  type IdentityProvisioner,
} from "../../../identity/identity.types.js";
import { AuditService } from "../../../policy/audit.service.js";
import { SessionService } from "../../../policy/session.service.js";
import { NotificationService } from "../notification/notification.service.js";
import { ClientLoginsRepository, type ClientLoginRow } from "./client-logins.repository.js";

/** Q5: a wedding has at most two client logins, one per side. */
const MAX_REPS_PER_WEDDING = 2;

function toView(row: ClientLoginRow): ClientLoginView {
  return {
    userId: row.userId,
    name: row.name,
    email: row.email,
    phone: row.phone,
    userStatus: row.userStatus,
    clientSide: row.clientSide,
    canViewFinance: row.canViewFinance,
    canApprove: row.canApprove,
    membershipStatus: row.membershipStatus,
    invitedAt: row.invitedAt ? row.invitedAt.toISOString() : null,
  };
}

/**
 * Client-login administration (Module A, feature 5.3): the client-representative portal logins of a
 * wedding. The controller's projectParam scopes the surface (SA/SM any wedding, PM only their own);
 * the Q5 cap holds at most two logins per wedding, one per side. Creating a login makes an `invited`
 * client user and a `client_representative` membership, issues an invite (feature 5.2) and queues its
 * delivery. Removing it ends the user's sessions. A new client only — reusing an existing client
 * across weddings (A-5) is a later increment. Every mutation is audited.
 */
@Injectable()
export class ClientLoginsService {
  constructor(
    private readonly repository: ClientLoginsRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
    private readonly authTokens: AuthTokenService,
    private readonly notifications: NotificationService,
    private readonly logger: AppLogger,
    @Inject(IDENTITY_PROVISIONER) private readonly provisioner: IdentityProvisioner,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async list(projectId: string): Promise<ClientLoginList> {
    const rows = await this.repository.listByProject(projectId);
    return { items: rows.map(toView) };
  }

  async get(projectId: string, userId: string): Promise<ClientLoginView> {
    return toView(await this.require(projectId, userId));
  }

  async create(
    projectId: string,
    request: ClientLoginCreateRequest,
    actorId: string,
  ): Promise<ClientLoginView> {
    const sides = await this.repository.liveRepSides(projectId);
    if (sides.length >= MAX_REPS_PER_WEDDING) {
      throw errors.conflict("A wedding can have at most two client logins");
    }
    if (sides.includes(request.clientSide)) {
      throw errors.conflict(`The ${request.clientSide} side already has a client login`);
    }
    if (await this.repository.emailExists(request.email)) {
      throw errors.conflict("A user with that email already exists");
    }
    const { userId, inviteToken } = await this.insertClientLogin(projectId, request, actorId);
    // Provision the Cognito sign-in account before the invite goes out, so the rep can sign in and
    // activate. Best-effort after commit, like delivery below (see provision()).
    await this.provision(userId, request.email, request.phone ?? null);
    // Delivery is best-effort and after commit: the login and its invite token are already saved, so a
    // transient queue failure must not fail the create or be mistaken for a conflict (it can be re-sent).
    // The failure is logged (not swallowed silently) so an undelivered invite is visible and re-sendable.
    await this.queueInvite(userId, request.name, inviteToken).catch((error: unknown) =>
      this.logger.warn("client.invite.notify_failed", { userId, error: String(error) }),
    );
    return this.get(projectId, userId);
  }

  /**
   * Re-issues an invite for a still-`invited` client login and re-queues its delivery (B2): the recovery
   * path when the first invite was never delivered or has expired. Issuing retires any live invite, so
   * only the newest link works. An already-activated login is refused.
   */
  async reinvite(projectId: string, userId: string): Promise<ClientLoginView> {
    const before = await this.require(projectId, userId);
    if (before.userStatus !== "invited") {
      throw errors.conflict(`A ${before.userStatus} client login cannot be re-invited`);
    }
    const inviteToken = await this.prisma.$transaction(async (tx) => {
      const token = await this.authTokens.issueInvite(userId, tx);
      await this.audit.record(
        {
          action: "update",
          entityType: "client_login",
          entityId: before.membershipId,
          after: { reinvited: true },
          maskImages: false,
        },
        tx,
      );
      return token;
    });
    // Re-provision idempotently: the recovery path when the first create's provisioning never ran.
    await this.provision(userId, before.email, before.phone);
    await this.queueInvite(userId, before.name, inviteToken).catch((error: unknown) =>
      this.logger.warn("client.reinvite.notify_failed", { userId, error: String(error) }),
    );
    return this.get(projectId, userId);
  }

  /**
   * Best-effort Cognito provisioning (cognito-setup §6); a no-op under `IDENTITY_PROVIDER=local`. Logged,
   * not fatal: the AMPM login and its invite already committed, and reinvite re-provisions idempotently, so
   * a transient AWS failure (or a client with no phone to host OTP sign-in) must not fail the invite.
   */
  private async provision(userId: string, email: string, phone: string | null): Promise<void> {
    await this.provisioner
      .provisionUser({ kind: "client", email, phone })
      .catch((error: unknown) =>
        this.logger.warn("client.provision.failed", { userId, error: String(error) }),
      );
  }

  async update(
    projectId: string,
    userId: string,
    request: ClientLoginUpdateRequest,
    actorId: string,
  ): Promise<ClientLoginView> {
    const before = await this.require(projectId, userId);
    await this.prisma.$transaction(async (tx) => {
      await this.repository.updateFlags(before.membershipId, request, actorId, tx);
      await this.audit.record(
        {
          action: "update",
          entityType: "client_login",
          entityId: before.membershipId,
          before: { canViewFinance: before.canViewFinance, canApprove: before.canApprove },
          after: {
            canViewFinance: request.canViewFinance ?? before.canViewFinance,
            canApprove: request.canApprove ?? before.canApprove,
          },
          maskImages: false,
        },
        tx,
      );
    });
    return this.get(projectId, userId);
  }

  async remove(projectId: string, userId: string, actorId: string): Promise<void> {
    const before = await this.require(projectId, userId);
    await this.prisma.$transaction(async (tx) => {
      await this.repository.removeMembership(before.membershipId, actorId, tx);
      // Retire any unredeemed invite so a rep removed before activation cannot activate into a
      // membership-less account.
      await this.authTokens.invalidateInvitesFor(userId, tx);
      await this.audit.record(
        {
          action: "delete",
          entityType: "client_login",
          entityId: before.membershipId,
          before: { projectId, userId, clientSide: before.clientSide },
          maskImages: false,
        },
        tx,
      );
    });
    await this.sessions.revokeAllForUser(userId, "membership_removed");
  }

  private async insertClientLogin(
    projectId: string,
    request: ClientLoginCreateRequest,
    actorId: string,
  ): Promise<{ userId: string; inviteToken: string }> {
    try {
      return await this.createWithInvite(projectId, request, actorId);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        // The cap pre-check and emailExists cover the common cases; this is the race backstop. The
        // partial index on (project_id, client_side) names the side; anything else is the email.
        const target = Array.isArray(error.meta?.target)
          ? error.meta.target.join(",")
          : String(error.meta?.target ?? "");
        if (target.includes("client_side")) {
          throw errors.conflict(`The ${request.clientSide} side already has a client login`);
        }
        throw errors.conflict("A user with that email already exists");
      }
      throw error;
    }
  }

  /** The client user + membership + invite + audit, in one transaction; returns the user id + token. */
  private createWithInvite(
    projectId: string,
    request: ClientLoginCreateRequest,
    actorId: string,
  ): Promise<{ userId: string; inviteToken: string }> {
    const flags = {
      canViewFinance: request.canViewFinance ?? false,
      canApprove: request.canApprove ?? false,
    };
    return this.prisma.$transaction(async (tx) => {
      const { userId, membershipId } = await this.repository.createClientWithMembership(
        {
          projectId,
          name: request.name,
          email: request.email,
          phone: request.phone,
          clientSide: request.clientSide,
          ...flags,
          createdBy: actorId,
        },
        tx,
      );
      const inviteToken = await this.authTokens.issueInvite(userId, tx);
      await this.audit.record(
        {
          action: "create",
          entityType: "client_login",
          entityId: membershipId,
          after: { projectId, userId, clientSide: request.clientSide, ...flags },
          maskImages: false,
        },
        tx,
      );
      return { userId, inviteToken };
    });
  }

  private async queueInvite(userId: string, name: string, inviteToken: string): Promise<void> {
    await this.notifications.queue({
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
  }

  private async require(projectId: string, userId: string): Promise<ClientLoginRow> {
    const row = await this.repository.findMembership(projectId, userId);
    if (!row) throw errors.notFound("No such client login");
    return row;
  }
}
