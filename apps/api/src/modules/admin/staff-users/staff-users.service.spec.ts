import { describe, expect, it, vi } from "vitest";

import type { AppLogger } from "../../../common/logger.service.js";
import type { AuditService } from "../../../policy/audit.service.js";
import type { PrismaService } from "../../../db/prisma.service.js";
import type { Env } from "../../../env.js";
import { Prisma } from "../../../generated/prisma/client.js";
import type { AuthTokenService } from "../../../identity/auth-token.service.js";
import type { IdentityProvisioner } from "../../../identity/identity.types.js";
import type { SessionService } from "../../../policy/session.service.js";
import type { NotificationService } from "../notification/notification.service.js";
import { StaffUsersRepository, type StaffUserRow } from "./staff-users.repository.js";
import { StaffUsersService } from "./staff-users.service.js";

class FakeRepository extends StaffUsersRepository {
  constructor(
    private readonly users: Record<string, StaffUserRow> = {},
    private readonly emailTaken = false,
  ) {
    super();
  }
  create = vi.fn(async () => ({ id: "user-new" }));
  update = vi.fn(async () => undefined);
  setStatus = vi.fn(async () => undefined);
  softDelete = vi.fn(async () => undefined);
  findById = vi.fn(async (id: string) => this.users[id] ?? null);
  list = vi.fn(async () => ({
    rows: Object.values(this.users),
    nextCursor: null as string | null,
  }));
  emailExists = vi.fn(async () => this.emailTaken);
  isActivated = vi.fn(async () => true);
}

function harness(repo: FakeRepository) {
  // Default: one other active Super Admin exists, so the last-SA guard never blocks unless a test says so.
  const userCount = vi.fn(async () => 1);
  const prisma = {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
    user: { count: userCount },
  } as unknown as PrismaService;
  const record = vi.fn(async () => undefined);
  const revokeAllForUser = vi.fn(async () => undefined);
  const issueInvite = vi.fn(async () => "raw-invite-token");
  const queue = vi.fn(async () => ({ suppressed: false, notificationId: "n1" }));
  const audit = { record } as unknown as AuditService;
  const sessions = { revokeAllForUser } as unknown as SessionService;
  const authTokens = { issueInvite } as unknown as AuthTokenService;
  const notifications = { queue } as unknown as NotificationService;
  const warn = vi.fn();
  const logger = { warn, info: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as AppLogger;
  const provisionUser = vi.fn(async () => undefined);
  const provisioner = { provisionUser } as unknown as IdentityProvisioner;
  const env = { WEB_APP_URL: "https://app.example" } as unknown as Env;
  return {
    service: new StaffUsersService(
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
    queue,
    warn,
    userCount,
    provisionUser,
  };
}

function row(id: string, status: StaffUserRow["status"]): StaffUserRow {
  return {
    id,
    name: "Dev Staff",
    email: `${id}@example.com`,
    phone: null,
    status,
    mfaEnabled: false,
    lastLoginAt: null,
    createdAt: new Date("2026-10-28T10:00:00.000Z"),
    roleKeys: [],
  };
}

describe("StaffUsersService", () => {
  it("refuses to create a user with an email already in use", async () => {
    const repo = new FakeRepository({}, true);
    await expect(
      harness(repo).service.create({ name: "X", email: "taken@example.com" }, "sa"),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("maps a concurrent duplicate-email insert (P2002) to 409, not 500", async () => {
    const repo = new FakeRepository(); // emailExists=false, so the pre-check passes and the insert races
    repo.create = vi.fn(async () => {
      throw new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "test",
      });
    });
    await expect(
      harness(repo).service.create({ name: "Race", email: "race@example.com" }, "sa"),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("creates an invited staff user, mints an invite, queues the delivery, and audits it", async () => {
    const repo = new FakeRepository({ "user-new": row("user-new", "invited") });
    const { service, record, issueInvite, queue, provisionUser } = harness(repo);
    const view = await service.create(
      { name: "New Staff", email: "new@example.com", phone: "+911234567890" },
      "sa",
    );
    expect(repo.create).toHaveBeenCalled();
    expect(view.status).toBe("invited");
    // Provisioned as staff (sign-in by email) before the invite is delivered (cognito-setup §6).
    expect(provisionUser).toHaveBeenCalledWith({
      kind: "staff",
      email: "new@example.com",
      phone: "+911234567890",
    });
    expect(issueInvite).toHaveBeenCalledWith("user-new", expect.anything());
    expect(queue).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "user-new",
        channel: "email",
        templateKey: "staff.invite",
        variables: expect.objectContaining({
          name: "New Staff",
          activationUrl: expect.stringContaining("raw-invite-token"),
        }),
      }),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "create", entityType: "user" }),
      expect.anything(),
    );
  });

  it("still invites when provisioning fails: the failure is logged, not fatal (best-effort §6)", async () => {
    const repo = new FakeRepository({ "user-new": row("user-new", "invited") });
    const { service, queue, warn, provisionUser } = harness(repo);
    (provisionUser as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("AWS down"));
    const view = await service.create({ name: "New Staff", email: "new@example.com" }, "sa");
    expect(view.status).toBe("invited"); // create succeeded despite the provisioning error
    expect(queue).toHaveBeenCalled(); // the invite still went out
    expect(warn).toHaveBeenCalledWith("staff.provision.failed", expect.objectContaining({ userId: "user-new" }));
  });

  it("re-provisions idempotently on reinvite", async () => {
    const repo = new FakeRepository({ u: row("u", "invited") });
    const { service, provisionUser } = harness(repo);
    await service.reinvite("u");
    expect(provisionUser).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "staff", email: "u@example.com" }),
    );
  });

  it("rejects an illegal status transition", async () => {
    const repo = new FakeRepository({ u: row("u", "invited") });
    await expect(
      harness(repo).service.setStatus("u", { status: "active" }, "sa"),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(repo.setStatus).not.toHaveBeenCalled();
  });

  it("disables an active user, audits it, and revokes their sessions", async () => {
    const repo = new FakeRepository({ u: row("u", "active") });
    const { service, record, revokeAllForUser } = harness(repo);
    await service.setStatus("u", { status: "disabled" }, "sa");
    expect(repo.setStatus).toHaveBeenCalledWith("u", "disabled", "sa", expect.anything());
    expect(revokeAllForUser).toHaveBeenCalledWith("u", "account_disabled");
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "update", entityType: "user" }),
      expect.anything(),
    );
  });

  it("re-enables a disabled user without revoking (they have no live session)", async () => {
    const repo = new FakeRepository({ u: row("u", "disabled") });
    const { service, revokeAllForUser } = harness(repo);
    await service.setStatus("u", { status: "active" }, "sa");
    expect(repo.setStatus).toHaveBeenCalledWith("u", "active", "sa", expect.anything());
    expect(revokeAllForUser).not.toHaveBeenCalled();
  });

  it("soft-deletes a user, audits it, and revokes their sessions", async () => {
    const repo = new FakeRepository({ u: row("u", "active") });
    const { service, record, revokeAllForUser } = harness(repo);
    await service.remove("u", "sa");
    expect(repo.softDelete).toHaveBeenCalledWith("u", "sa", expect.anything());
    expect(revokeAllForUser).toHaveBeenCalledWith("u", "account_deleted");
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "delete", entityType: "user" }),
      expect.anything(),
    );
  });

  it("refuses re-activating a disabled user who never activated (B4)", async () => {
    const repo = new FakeRepository({ u: row("u", "disabled") });
    repo.isActivated = vi.fn(async () => false);
    await expect(
      harness(repo).service.setStatus("u", { status: "active" }, "sa"),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(repo.setStatus).not.toHaveBeenCalled();
  });

  it("re-activates a disabled user who had activated (B4)", async () => {
    const repo = new FakeRepository({ u: row("u", "disabled") });
    repo.isActivated = vi.fn(async () => true);
    await harness(repo).service.setStatus("u", { status: "active" }, "sa");
    expect(repo.setStatus).toHaveBeenCalledWith("u", "active", "sa", expect.anything());
  });

  it("refuses disabling the last active Super Admin (B3)", async () => {
    const repo = new FakeRepository({ u: { ...row("u", "active"), roleKeys: ["super_admin"] } });
    const { service, userCount } = harness(repo);
    userCount.mockResolvedValueOnce(1).mockResolvedValueOnce(0); // target is an active SA; no other
    await expect(service.setStatus("u", { status: "disabled" }, "sa")).rejects.toMatchObject({
      code: "conflict",
    });
    expect(repo.setStatus).not.toHaveBeenCalled();
  });

  it("disables a Super Admin when another active one remains (B3)", async () => {
    const repo = new FakeRepository({ u: { ...row("u", "active"), roleKeys: ["super_admin"] } });
    const { service, userCount } = harness(repo);
    userCount.mockResolvedValueOnce(1).mockResolvedValueOnce(1); // another active SA exists
    await service.setStatus("u", { status: "disabled" }, "sa");
    expect(repo.setStatus).toHaveBeenCalledWith("u", "disabled", "sa", expect.anything());
  });

  it("refuses deleting the last active Super Admin (B3)", async () => {
    const repo = new FakeRepository({ u: { ...row("u", "active"), roleKeys: ["super_admin"] } });
    const { service, userCount } = harness(repo);
    userCount.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    await expect(service.remove("u", "sa")).rejects.toMatchObject({ code: "conflict" });
    expect(repo.softDelete).not.toHaveBeenCalled();
  });

  it("404s a missing staff user", async () => {
    await expect(harness(new FakeRepository()).service.get("missing")).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("re-invites an invited user: issues a fresh invite, re-queues delivery, and audits it (B2)", async () => {
    const repo = new FakeRepository({ u: row("u", "invited") });
    const { service, record, issueInvite, queue } = harness(repo);
    const view = await service.reinvite("u");
    expect(view.status).toBe("invited");
    expect(issueInvite).toHaveBeenCalledWith("u", expect.anything());
    expect(queue).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: "u", templateKey: "staff.invite" }),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "update",
        entityType: "user",
        after: expect.objectContaining({ reinvited: true }),
      }),
      expect.anything(),
    );
  });

  it("refuses to re-invite a user who is not invited (B2)", async () => {
    const repo = new FakeRepository({ u: row("u", "active") });
    const { service, issueInvite } = harness(repo);
    await expect(service.reinvite("u")).rejects.toMatchObject({ code: "conflict" });
    expect(issueInvite).not.toHaveBeenCalled();
  });
});
