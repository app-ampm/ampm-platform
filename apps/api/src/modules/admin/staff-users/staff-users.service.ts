import { Inject, Injectable } from "@nestjs/common";
import {
  errors,
  type StaffUserCreateRequest,
  type StaffUserPage,
  type StaffUserQuery,
  type StaffUserStatusRequest,
  type StaffUserUpdateRequest,
  type StaffUserView,
  type UserStatus,
} from "@ampm/core";

import { AppLogger } from "../../../common/logger.service.js";
import { PrismaService } from "../../../db/prisma.service.js";
import { ENV, type Env } from "../../../env.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { AuthTokenService } from "../../../identity/auth-token.service.js";
import { AuditService } from "../../../policy/audit.service.js";
import { SessionService } from "../../../policy/session.service.js";
import { assertNotLastSuperAdmin } from "../last-super-admin.js";
import { NotificationService } from "../notification/notification.service.js";
import { StaffUsersRepository, type StaffUserRow } from "./staff-users.repository.js";

/** The Super Admin role's key; disabling or deleting the last active holder is refused (B3). */
const SUPER_ADMIN_ROLE_KEY = "super_admin";

/**
 * The admin status moves this surface allows. There is no `user` state machine in the policy engine,
 * so the transitions are enforced here: an invited or active user can be disabled, a disabled user
 * re-activated. `invited → active` is activation (feature 5.2), not an admin set; `locked` is the
 * identity service's.
 */
const STATUS_MOVES: Record<UserStatus, readonly UserStatus[]> = {
  invited: ["disabled"],
  active: ["disabled"],
  disabled: ["active"],
  locked: [],
};

function toView(row: StaffUserRow): StaffUserView {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    mfaEnabled: row.mfaEnabled,
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    roles: [...row.roleKeys],
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Staff-user administration (Module A, feature 5.1). Create leaves the user `invited`; invite delivery
 * and activation are feature 5.2. Role assignment is the separate /admin/users surface (slice 6a).
 * Every mutation runs in one transaction with its before/after audit (PII masked), and a disable or
 * delete revokes the user's sessions so access ends at once.
 */
@Injectable()
export class StaffUsersService {
  constructor(
    private readonly repository: StaffUsersRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
    private readonly authTokens: AuthTokenService,
    private readonly notifications: NotificationService,
    private readonly logger: AppLogger,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async list(query: StaffUserQuery): Promise<StaffUserPage> {
    const { rows, nextCursor } = await this.repository.list(
      query.limit,
      query.cursor,
      query.status,
    );
    return { items: rows.map(toView), nextCursor };
  }

  async get(id: string): Promise<StaffUserView> {
    return toView(await this.require(id));
  }

  async create(request: StaffUserCreateRequest, actorId: string): Promise<StaffUserView> {
    if (await this.repository.emailExists(request.email)) {
      throw errors.conflict("A user with that email already exists");
    }
    const { id, inviteToken } = await this.insertInvited(request, actorId);
    // Best-effort delivery after commit: the user and its invite token are already saved, so a queue
    // failure cannot be mistaken for a duplicate-email conflict, roll back the account, or fail create.
    // The failure is logged (not swallowed silently) so an undelivered invite is visible and re-sendable.
    await this.queueInvite(id, request.name, inviteToken).catch((error: unknown) =>
      this.logger.warn("staff.invite.notify_failed", { userId: id, error: String(error) }),
    );
    return this.get(id);
  }

  /**
   * Re-issues an invite for a still-`invited` user and re-queues its delivery (feature 5.2, B2): the
   * recovery path when the first invite was never delivered or has expired. Issuing retires any live
   * invite, so only the newest link works. An already-activated or disabled user is refused.
   */
  async reinvite(id: string): Promise<StaffUserView> {
    const user = await this.require(id);
    if (user.status !== "invited") {
      throw errors.conflict(`A ${user.status} user cannot be re-invited`);
    }
    const inviteToken = await this.prisma.$transaction(async (tx) => {
      const token = await this.authTokens.issueInvite(id, tx);
      await this.audit.record(
        { action: "update", entityType: "user", entityId: id, after: { reinvited: true } },
        tx,
      );
      return token;
    });
    await this.queueInvite(id, user.name, inviteToken).catch((error: unknown) =>
      this.logger.warn("staff.reinvite.notify_failed", { userId: id, error: String(error) }),
    );
    return this.get(id);
  }

  /** Creates the invited user and its invite in one transaction; a lost unique-email race maps to 409. */
  private async insertInvited(
    request: StaffUserCreateRequest,
    actorId: string,
  ): Promise<{ id: string; inviteToken: string }> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await this.repository.create(
          { name: request.name, email: request.email, phone: request.phone, createdBy: actorId },
          tx,
        );
        // Mint the invite in the same transaction so it commits with the user (feature 5.2). The raw
        // token is held server-only on the notification row's `data` until delivery, then cleared, and
        // never appears in a view (D-044); otherwise it is stored only as its hash.
        const inviteToken = await this.authTokens.issueInvite(created.id, tx);
        await this.audit.record(
          {
            action: "create",
            entityType: "user",
            entityId: created.id,
            after: {
              name: request.name,
              email: request.email,
              phone: request.phone ?? null,
              status: "invited",
            },
          },
          tx,
        );
        return { id: created.id, inviteToken };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw errors.conflict("A user with that email already exists");
      }
      throw error;
    }
  }

  async update(
    id: string,
    request: StaffUserUpdateRequest,
    actorId: string,
  ): Promise<StaffUserView> {
    const before = await this.require(id);
    await this.prisma.$transaction(async (tx) => {
      await this.repository.update(id, request, actorId, tx);
      await this.audit.record(
        {
          action: "update",
          entityType: "user",
          entityId: id,
          before: { name: before.name, phone: before.phone, mfaEnabled: before.mfaEnabled },
          after: {
            name: request.name ?? before.name,
            phone: request.phone !== undefined ? request.phone : before.phone,
            mfaEnabled: request.mfaEnabled ?? before.mfaEnabled,
          },
        },
        tx,
      );
    });
    return this.get(id);
  }

  async setStatus(
    id: string,
    request: StaffUserStatusRequest,
    actorId: string,
  ): Promise<StaffUserView> {
    const before = await this.require(id);
    if (!STATUS_MOVES[before.status].includes(request.status)) {
      throw errors.conflict(`A ${before.status} user cannot be moved to ${request.status}`);
    }
    // B4: re-activating a user who never activated would make them `active` with no identity subject —
    // they could not sign in, and their invite could no longer be claimed. Recover by deleting and
    // re-creating (the email frees on delete, B9), or by re-inviting while still invited.
    if (
      before.status === "disabled" &&
      request.status === "active" &&
      !(await this.repository.isActivated(id))
    ) {
      throw errors.conflict(
        "This user never activated, so it cannot be re-activated; delete it and send a fresh invitation",
      );
    }
    // B3: disabling the last active Super Admin would lock the SA-only surface out.
    if (request.status === "disabled" && before.roleKeys.includes(SUPER_ADMIN_ROLE_KEY)) {
      await assertNotLastSuperAdmin(this.prisma, id);
    }
    await this.prisma.$transaction(async (tx) => {
      await this.repository.setStatus(id, request.status, actorId, tx);
      await this.audit.record(
        {
          action: "update",
          entityType: "user",
          entityId: id,
          before: { status: before.status },
          after: { status: request.status },
          maskImages: false,
        },
        tx,
      );
    });
    if (request.status === "disabled") await this.revoke(id, "account_disabled");
    return this.get(id);
  }

  async remove(id: string, actorId: string): Promise<void> {
    const before = await this.require(id);
    // B3: deleting the last active Super Admin would lock the SA-only surface out.
    if (before.roleKeys.includes(SUPER_ADMIN_ROLE_KEY)) {
      await assertNotLastSuperAdmin(this.prisma, id);
    }
    await this.prisma.$transaction(async (tx) => {
      await this.repository.softDelete(id, actorId, tx);
      await this.audit.record(
        {
          action: "delete",
          entityType: "user",
          entityId: id,
          before: { name: before.name, email: before.email, status: before.status },
        },
        tx,
      );
    });
    await this.revoke(id, "account_deleted");
  }

  /** Queues the out-of-band invite delivery (feature 5.2; console stub in dev, email in sprint 5). */
  private async queueInvite(userId: string, name: string, inviteToken: string): Promise<void> {
    await this.notifications.queue({
      recipientType: "user",
      recipientId: userId,
      channel: "email",
      eventType: "staff.invited",
      templateKey: "staff.invite",
      entityType: "user",
      entityId: userId,
      variables: {
        name,
        activationUrl: `${this.env.WEB_APP_URL}/activate?token=${encodeURIComponent(inviteToken)}`,
      },
    });
  }

  private async require(id: string): Promise<StaffUserRow> {
    const user = await this.repository.findById(id);
    if (!user) throw errors.notFound("No such staff user");
    return user;
  }

  private async revoke(userId: string, reason: string): Promise<void> {
    await this.sessions.revokeAllForUser(userId, reason);
  }
}
