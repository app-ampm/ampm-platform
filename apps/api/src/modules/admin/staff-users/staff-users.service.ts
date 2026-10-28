import { Injectable } from "@nestjs/common";
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

import { PrismaService } from "../../../db/prisma.service.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { AuditService } from "../../../policy/audit.service.js";
import { SessionService } from "../../../policy/session.service.js";
import { StaffUsersRepository, type StaffUserRow } from "./staff-users.repository.js";

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
    try {
      const { id } = await this.prisma.$transaction(async (tx) => {
        const created = await this.repository.create(
          { name: request.name, email: request.email, phone: request.phone, createdBy: actorId },
          tx,
        );
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
        return created;
      });
      return await this.get(id);
    } catch (error) {
      // A concurrent create won the insert on the unique email, which the pre-check could not see.
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

  private async require(id: string): Promise<StaffUserRow> {
    const user = await this.repository.findById(id);
    if (!user) throw errors.notFound("No such staff user");
    return user;
  }

  private async revoke(userId: string, reason: string): Promise<void> {
    await this.sessions.revokeAllForUser(userId, reason);
  }
}
