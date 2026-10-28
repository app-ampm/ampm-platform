import { describe, expect, it, vi } from "vitest";

import type { AuditService } from "../../../policy/audit.service.js";
import type { PrismaService } from "../../../db/prisma.service.js";
import { Prisma } from "../../../generated/prisma/client.js";
import type { SessionService } from "../../../policy/session.service.js";
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
}

function harness(repo: FakeRepository) {
  const prisma = {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
  } as unknown as PrismaService;
  const record = vi.fn(async () => undefined);
  const revokeAllForUser = vi.fn(async () => undefined);
  const audit = { record } as unknown as AuditService;
  const sessions = { revokeAllForUser } as unknown as SessionService;
  return {
    service: new StaffUsersService(repo, prisma, audit, sessions),
    record,
    revokeAllForUser,
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

  it("creates an invited staff user and audits it", async () => {
    const repo = new FakeRepository({ "user-new": row("user-new", "invited") });
    const { service, record } = harness(repo);
    const view = await service.create({ name: "New Staff", email: "new@example.com" }, "sa");
    expect(repo.create).toHaveBeenCalled();
    expect(view.status).toBe("invited");
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "create", entityType: "user" }),
      expect.anything(),
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

  it("404s a missing staff user", async () => {
    await expect(harness(new FakeRepository()).service.get("missing")).rejects.toMatchObject({
      code: "not_found",
    });
  });
});
