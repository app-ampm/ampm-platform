import type { ClientSide } from "@ampm/core";
import { describe, expect, it, vi } from "vitest";

import type { AuditService } from "../../../policy/audit.service.js";
import type { PrismaService } from "../../../db/prisma.service.js";
import type { AuthTokenService } from "../../../identity/auth-token.service.js";
import type { SessionService } from "../../../policy/session.service.js";
import type { NotificationService } from "../notification/notification.service.js";
import { ClientLoginsRepository, type ClientLoginRow } from "./client-logins.repository.js";
import { ClientLoginsService } from "./client-logins.service.js";

const PROJECT = "0192f3a0-7d3e-7b1a-9c2f-0000000000a1";

class FakeRepository extends ClientLoginsRepository {
  constructor(
    private readonly rows: Record<string, ClientLoginRow> = {},
    private readonly sides: (ClientSide | null)[] = [],
    private readonly emailTaken = false,
  ) {
    super();
  }
  createClientWithMembership = vi.fn(async () => ({ userId: "client-new", membershipId: "m-new" }));
  listByProject = vi.fn(async () => Object.values(this.rows));
  findMembership = vi.fn(async (_projectId: string, userId: string) => this.rows[userId] ?? null);
  updateFlags = vi.fn(async () => undefined);
  removeMembership = vi.fn(async () => undefined);
  emailExists = vi.fn(async () => this.emailTaken);
  liveRepSides = vi.fn(async () => this.sides);
}

function harness(repo: FakeRepository) {
  const prisma = {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
  } as unknown as PrismaService;
  const record = vi.fn(async () => undefined);
  const revokeAllForUser = vi.fn(async () => undefined);
  const issueInvite = vi.fn(async () => "raw-token");
  const invalidateInvitesFor = vi.fn(async () => undefined);
  const queue = vi.fn(async () => ({ suppressed: false, notificationId: "n1" }));
  const audit = { record } as unknown as AuditService;
  const sessions = { revokeAllForUser } as unknown as SessionService;
  const authTokens = { issueInvite, invalidateInvitesFor } as unknown as AuthTokenService;
  const notifications = { queue } as unknown as NotificationService;
  return {
    service: new ClientLoginsService(repo, prisma, audit, sessions, authTokens, notifications),
    record,
    revokeAllForUser,
    issueInvite,
    invalidateInvitesFor,
    queue,
  };
}

function row(userId: string, clientSide: ClientSide): ClientLoginRow {
  return {
    userId,
    name: "Client Rep",
    email: `${userId}@example.com`,
    phone: null,
    userStatus: "invited",
    membershipId: `m-${userId}`,
    clientSide,
    canViewFinance: false,
    canApprove: false,
    membershipStatus: "invited",
    invitedAt: new Date("2026-10-28T10:00:00.000Z"),
  };
}

const create = { name: "Rep", email: "rep@example.com", clientSide: "bride" as ClientSide };

describe("ClientLoginsService", () => {
  it("refuses a third login on a wedding (the Q5 cap)", async () => {
    const repo = new FakeRepository({}, ["bride", "groom"]);
    await expect(harness(repo).service.create(PROJECT, create, "sa")).rejects.toMatchObject({
      code: "conflict",
    });
    expect(repo.createClientWithMembership).not.toHaveBeenCalled();
  });

  it("refuses a second login on the same side", async () => {
    const repo = new FakeRepository({}, ["bride"]);
    await expect(harness(repo).service.create(PROJECT, create, "sa")).rejects.toMatchObject({
      code: "conflict",
    });
    expect(repo.createClientWithMembership).not.toHaveBeenCalled();
  });

  it("refuses a duplicate email", async () => {
    const repo = new FakeRepository({}, [], true);
    await expect(harness(repo).service.create(PROJECT, create, "sa")).rejects.toMatchObject({
      code: "conflict",
    });
    expect(repo.createClientWithMembership).not.toHaveBeenCalled();
  });

  it("creates a login, mints an invite, queues delivery, and audits it", async () => {
    const repo = new FakeRepository({ "client-new": row("client-new", "groom") }, ["bride"]);
    const { service, record, issueInvite, queue } = harness(repo);
    const view = await service.create(PROJECT, { ...create, clientSide: "groom" }, "sa");
    expect(repo.createClientWithMembership).toHaveBeenCalled();
    expect(issueInvite).toHaveBeenCalledWith("client-new", expect.anything());
    expect(queue).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: "client-new", templateKey: "client.invite" }),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "create", entityType: "client_login" }),
      expect.anything(),
    );
    expect(view.clientSide).toBe("groom");
  });

  it("updates the finance/approval flags and audits it", async () => {
    const repo = new FakeRepository({ u1: row("u1", "bride") });
    const { service, record } = harness(repo);
    await service.update(PROJECT, "u1", { canViewFinance: true }, "sa");
    expect(repo.updateFlags).toHaveBeenCalledWith(
      "m-u1",
      { canViewFinance: true },
      "sa",
      expect.anything(),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "update", entityType: "client_login" }),
      expect.anything(),
    );
  });

  it("removes a login, retires its invite, audits it, and revokes the user's sessions", async () => {
    const repo = new FakeRepository({ u1: row("u1", "bride") });
    const { service, revokeAllForUser, record, invalidateInvitesFor } = harness(repo);
    await service.remove(PROJECT, "u1", "sa");
    expect(repo.removeMembership).toHaveBeenCalledWith("m-u1", "sa", expect.anything());
    expect(invalidateInvitesFor).toHaveBeenCalledWith("u1", expect.anything());
    expect(revokeAllForUser).toHaveBeenCalledWith("u1", "membership_removed");
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "delete", entityType: "client_login" }),
      expect.anything(),
    );
  });

  it("404s a missing login", async () => {
    await expect(harness(new FakeRepository()).service.get(PROJECT, "nope")).rejects.toMatchObject({
      code: "not_found",
    });
  });
});
