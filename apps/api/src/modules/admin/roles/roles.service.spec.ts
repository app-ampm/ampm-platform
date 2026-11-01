import type { StaffRole } from "@ampm/policy";
import { describe, expect, it, vi } from "vitest";

import type { AuditService } from "../../../policy/audit.service.js";
import type { PrismaService } from "../../../db/prisma.service.js";
import type { Principal } from "../../../policy/principal.types.js";
import type { SessionService } from "../../../policy/session.service.js";
import { RolesRepository, type RoleRow } from "./roles.repository.js";
import { RolesService } from "./roles.service.js";

/** A staff principal holding the given system roles — the actor of an assignment. */
function staff(roles: StaffRole[]): Principal {
  return {
    type: "staff",
    userId: "actor",
    name: "Actor",
    email: null,
    phone: null,
    status: "active",
    lastLoginAt: null,
    memberships: [],
    roles,
  };
}

class FakeRepository extends RolesRepository {
  constructor(private readonly roles: Record<string, RoleRow> = {}) {
    super();
  }
  create = vi.fn(async () => ({ id: "role-new" }));
  rename = vi.fn(async () => undefined);
  setGrants = vi.fn(async () => undefined);
  softDelete = vi.fn(async () => undefined);
  findById = vi.fn(async (id: string) => this.roles[id] ?? null);
  listCustom = vi.fn(async () => Object.values(this.roles).filter((role) => !role.isSystem));
  userIdsWithRole = vi.fn(async () => []);
  assign = vi.fn(async () => undefined);
  unassign = vi.fn(async () => 1);
  userExists = vi.fn(async () => true);
}

function service(repo: FakeRepository, userCount = vi.fn(async () => 1)) {
  const prisma = {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
    // Default: another active Super Admin exists, so the last-SA guard (B3) never blocks unless a test says so.
    user: { count: userCount },
  } as unknown as PrismaService;
  const audit = { record: vi.fn(async () => undefined) } as unknown as AuditService;
  const sessions = { revokeAllForUser: vi.fn(async () => undefined) } as unknown as SessionService;
  return new RolesService(repo, prisma, audit, sessions);
}

const systemRole: RoleRow = {
  id: "0192f3a0-7d3e-7b1a-9c2f-0000000000a1",
  roleKey: "super_admin",
  name: "Super Admin",
  isSystem: true,
  capabilityKeys: [],
};

const customRole: RoleRow = {
  id: "0192f3a0-7d3e-7b1a-9c2f-0000000000b2",
  roleKey: "custom_config",
  name: "Config editor",
  isSystem: false,
  capabilityKeys: ["admin.configurations.update:all"],
};

describe("RolesService guardrails", () => {
  it("offers only assignable capabilities (never an escalation-locked one)", () => {
    const list = service(new FakeRepository()).capabilities();
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((capability) => !capability.isEscalationLocked)).toBe(true);
  });

  it("refuses to grant an escalation-locked capability to a custom role", async () => {
    const repo = new FakeRepository();
    await expect(
      service(repo).create({ name: "Impostor", capabilityIds: ["admin.roles.update:all"] }, "sa"),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("refuses an unknown capability", async () => {
    const repo = new FakeRepository();
    await expect(
      service(repo).create({ name: "Bad", capabilityIds: ["nope.not.real:all"] }, "sa"),
    ).rejects.toMatchObject({ code: "validation_failed" });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("creates a custom role from assignable capabilities", async () => {
    const repo = new FakeRepository({
      "role-new": {
        id: "role-new",
        roleKey: "custom_x",
        name: "Config editor",
        isSystem: false,
        capabilityKeys: ["admin.configurations.update:all"],
      },
    });
    const view = await service(repo).create(
      { name: "Config editor", capabilityIds: ["admin.configurations.update:all"] },
      "sa",
    );
    expect(repo.create).toHaveBeenCalled();
    expect(repo.setGrants).toHaveBeenCalledWith(
      "role-new",
      ["admin.configurations.update:all"],
      "sa",
      expect.anything(),
    );
    expect(view.capabilities.map((capability) => capability.id)).toEqual([
      "admin.configurations.update:all",
    ]);
  });

  it("refuses to edit or delete a system role", async () => {
    const repo = new FakeRepository({ [systemRole.id]: systemRole });
    const svc = service(repo);
    await expect(svc.update(systemRole.id, { name: "x" }, "sa")).rejects.toMatchObject({
      code: "conflict",
    });
    await expect(svc.remove(systemRole.id, "sa")).rejects.toMatchObject({ code: "conflict" });
    expect(repo.softDelete).not.toHaveBeenCalled();
  });

  it("refuses to grant an escalation-locked capability on update", async () => {
    const repo = new FakeRepository({ [customRole.id]: customRole });
    await expect(
      service(repo).update(customRole.id, { capabilityIds: ["admin.roles.update:all"] }, "sa"),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(repo.setGrants).not.toHaveBeenCalled();
  });

  it("refuses an unknown capability on update", async () => {
    const repo = new FakeRepository({ [customRole.id]: customRole });
    await expect(
      service(repo).update(customRole.id, { capabilityIds: ["nope.not.real:all"] }, "sa"),
    ).rejects.toMatchObject({ code: "validation_failed" });
    expect(repo.setGrants).not.toHaveBeenCalled();
  });

  it("lets a Super Admin assign a system role", async () => {
    const repo = new FakeRepository({ [systemRole.id]: systemRole });
    await expect(
      service(repo).assign("user-1", systemRole.id, staff(["SA"])),
    ).resolves.toBeUndefined();
    expect(repo.assign).toHaveBeenCalledWith("user-1", systemRole.id, expect.anything());
  });

  it("refuses a non-Super-Admin assigning a system role", async () => {
    const repo = new FakeRepository({ [systemRole.id]: systemRole });
    await expect(
      service(repo).assign("user-1", systemRole.id, staff(["PM"])),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(repo.assign).not.toHaveBeenCalled();
  });

  it("refuses unassigning Super Admin from the last active Super Admin (B3)", async () => {
    const repo = new FakeRepository({ [systemRole.id]: systemRole });
    const userCount = vi.fn<() => Promise<number>>();
    userCount.mockResolvedValueOnce(1).mockResolvedValueOnce(0); // target is an active SA; no other
    await expect(service(repo, userCount).unassign("user-1", systemRole.id)).rejects.toMatchObject({
      code: "conflict",
    });
    expect(repo.unassign).not.toHaveBeenCalled();
  });

  it("unassigns Super Admin when another active one remains (B3)", async () => {
    const repo = new FakeRepository({ [systemRole.id]: systemRole });
    const userCount = vi.fn<() => Promise<number>>();
    userCount.mockResolvedValueOnce(1).mockResolvedValueOnce(1); // another active SA exists
    await service(repo, userCount).unassign("user-1", systemRole.id);
    expect(repo.unassign).toHaveBeenCalledWith("user-1", systemRole.id, expect.anything());
  });

  it("unassigns a custom role without the last-Super-Admin check (B3)", async () => {
    const repo = new FakeRepository({ [customRole.id]: customRole });
    await service(repo).unassign("user-1", customRole.id);
    expect(repo.unassign).toHaveBeenCalledWith("user-1", customRole.id, expect.anything());
  });

  it("lets any staff admin assign a custom role", async () => {
    const repo = new FakeRepository({ [customRole.id]: customRole });
    await expect(
      service(repo).assign("user-1", customRole.id, staff(["PM"])),
    ).resolves.toBeUndefined();
    expect(repo.assign).toHaveBeenCalledWith("user-1", customRole.id, expect.anything());
  });

  it("404s a missing role", async () => {
    await expect(
      service(new FakeRepository()).get("0192f3a0-7d3e-7b1a-9c2f-0000000000ff"),
    ).rejects.toMatchObject({
      code: "not_found",
    });
  });
});
