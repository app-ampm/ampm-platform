import type { ClientSide } from "@ampm/core";
import { describe, expect, it, vi } from "vitest";

import type { AppLogger } from "../../../common/logger.service.js";
import type { AuditService } from "../../../policy/audit.service.js";
import type { PrismaService } from "../../../db/prisma.service.js";
import type { Env } from "../../../env.js";
import type { AuthTokenService } from "../../../identity/auth-token.service.js";
import type { IdentityProvisioner } from "../../../identity/identity.types.js";
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
  const warn = vi.fn();
  const logger = { warn, info: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as AppLogger;
  const provisionUser = vi.fn(async () => undefined);
  const provisioner = { provisionUser } as unknown as IdentityProvisioner;
  const env = { WEB_APP_URL: "https://app.example" } as unknown as Env;
  return {
    service: new ClientLoginsService(
      repo,
      prisma,
      audit,
      sessions,
      authTokens,
      notifications,
      logger,
      provisioner,
      env,
    ),
    record,
    revokeAllForUser,
    issueInvite,
    invalidateInvitesFor,
    queue,
    warn,
    provisionUser,
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
    const { service, record, issueInvite, queue, provisionUser } = harness(repo);
    const view = await service.create(
      PROJECT,
      { ...create, clientSide: "groom", phone: "+911234567890" },
      "sa",
    );
    expect(repo.createClientWithMembership).toHaveBeenCalled();
    // Provisioned as a client (sign-in by phone + OTP) before the invite is delivered (cognito-setup §6).
    expect(provisionUser).toHaveBeenCalledWith({
      kind: "client",
      email: "rep@example.com",
      phone: "+911234567890",
    });
    expect(issueInvite).toHaveBeenCalledWith("client-new", expect.anything());
    expect(queue).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "client-new",
        templateKey: "client.invite",
        variables: expect.objectContaining({
          name: "Rep",
          activationUrl: expect.stringContaining("raw-token"),
        }),
      }),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "create", entityType: "client_login" }),
      expect.anything(),
    );
    expect(view.clientSide).toBe("groom");
  });

  it("still invites when provisioning fails: the failure is logged, not fatal (best-effort §6)", async () => {
    const repo = new FakeRepository({ "client-new": row("client-new", "groom") }, ["bride"]);
    const { service, queue, warn, provisionUser } = harness(repo);
    (provisionUser as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("AWS down"));
    const view = await service.create(PROJECT, { ...create, clientSide: "groom" }, "sa");
    expect(view.clientSide).toBe("groom"); // create succeeded despite the provisioning error
    expect(queue).toHaveBeenCalled(); // the invite still went out
    expect(warn).toHaveBeenCalledWith(
      "client.provision.failed",
      expect.objectContaining({ userId: "client-new" }),
    );
  });

  it("re-provisions idempotently on reinvite", async () => {
    const repo = new FakeRepository({ u1: row("u1", "bride") });
    const { service, provisionUser } = harness(repo);
    await service.reinvite(PROJECT, "u1");
    expect(provisionUser).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "client", email: "u1@example.com" }),
    );
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

  it("re-invites an invited login: issues a fresh invite, re-queues delivery, and audits it (B2)", async () => {
    const repo = new FakeRepository({ u1: row("u1", "bride") });
    const { service, record, issueInvite, queue } = harness(repo);
    await service.reinvite(PROJECT, "u1");
    expect(issueInvite).toHaveBeenCalledWith("u1", expect.anything());
    expect(queue).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: "u1", templateKey: "client.invite" }),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "update",
        entityType: "client_login",
        after: expect.objectContaining({ reinvited: true }),
      }),
      expect.anything(),
    );
  });

  it("refuses to re-invite a login that is already activated (B2)", async () => {
    const repo = new FakeRepository({ u1: { ...row("u1", "bride"), userStatus: "active" } });
    const { service, issueInvite } = harness(repo);
    await expect(service.reinvite(PROJECT, "u1")).rejects.toMatchObject({ code: "conflict" });
    expect(issueInvite).not.toHaveBeenCalled();
  });
});
