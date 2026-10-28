import { Injectable } from "@nestjs/common";
import {
  errors,
  type ClientLoginCreateRequest,
  type ClientLoginList,
  type ClientLoginUpdateRequest,
  type ClientLoginView,
} from "@ampm/core";

import { PrismaService } from "../../../db/prisma.service.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { AuthTokenService } from "../../../identity/auth-token.service.js";
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
    const userId = await this.insertClientLogin(projectId, request, actorId);
    // Delivery is best-effort and after commit: the login and its invite token are already saved, so a
    // transient queue failure must not fail the create or be mistaken for a conflict (it can be re-sent).
    await this.queueInvite(userId).catch(() => undefined);
    return this.get(projectId, userId);
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
  ): Promise<string> {
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

  /** The client user + membership + invite + audit, in one transaction; returns the new user id. */
  private createWithInvite(
    projectId: string,
    request: ClientLoginCreateRequest,
    actorId: string,
  ): Promise<string> {
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
      await this.authTokens.issueInvite(userId, tx);
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
      return userId;
    });
  }

  private async queueInvite(userId: string): Promise<void> {
    await this.notifications.queue({
      recipientType: "user",
      recipientId: userId,
      channel: "email",
      eventType: "client.invited",
      templateKey: "client.invite",
      entityType: "user",
      entityId: userId,
    });
  }

  private async require(projectId: string, userId: string): Promise<ClientLoginRow> {
    const row = await this.repository.findMembership(projectId, userId);
    if (!row) throw errors.notFound("No such client login");
    return row;
  }
}
