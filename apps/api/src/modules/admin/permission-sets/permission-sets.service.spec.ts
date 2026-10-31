import { describe, expect, it, vi } from "vitest";

import type { AuditService } from "../../../policy/audit.service.js";
import type { PrismaService } from "../../../db/prisma.service.js";
import type { SessionService } from "../../../policy/session.service.js";
import { PermissionSetsRepository, type PermissionSetRow } from "./permission-sets.repository.js";
import { PermissionSetsService } from "./permission-sets.service.js";

class FakeRepository extends PermissionSetsRepository {
  constructor(
    private readonly sets: Record<string, PermissionSetRow> = {},
    private readonly role: { isSystem: boolean } | null = { isSystem: false },
  ) {
    super();
  }
  create = vi.fn(async () => ({ id: "set-new" }));
  updateMeta = vi.fn(async () => undefined);
  setGrants = vi.fn(async () => undefined);
  softDelete = vi.fn(async () => undefined);
  findById = vi.fn(async (id: string) => this.sets[id] ?? null);
  listCustom = vi.fn(async () => Object.values(this.sets).filter((set) => !set.isSystem));
  findRole = vi.fn(async () => this.role);
  attach = vi.fn(async () => 1);
  detach = vi.fn(async () => 1);
  userIdsWithRole = vi.fn(async (): Promise<string[]> => []);
  userIdsWithSet = vi.fn(async (): Promise<string[]> => []);
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
    service: new PermissionSetsService(repo, prisma, audit, sessions),
    record,
    revokeAllForUser,
  };
}

function service(repo: FakeRepository) {
  return harness(repo).service;
}

const systemSet: PermissionSetRow = {
  id: "0192f3a0-7d3e-7b1a-9c2f-0000000000c1",
  setKey: "system_core",
  name: "Core",
  description: null,
  isSystem: true,
  capabilityKeys: [],
};

const customSet: PermissionSetRow = {
  id: "0192f3a0-7d3e-7b1a-9c2f-0000000000c2",
  setKey: "custom_config",
  name: "Config editing",
  description: "Edit configuration",
  isSystem: false,
  capabilityKeys: ["admin.configurations.update:all"],
};

describe("PermissionSetsService guardrails", () => {
  it("refuses to grant an escalation-locked capability to a set", async () => {
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

  it("creates a set from assignable capabilities", async () => {
    const repo = new FakeRepository({
      "set-new": {
        id: "set-new",
        setKey: "custom_x",
        name: "Config editing",
        description: null,
        isSystem: false,
        capabilityKeys: ["admin.configurations.update:all"],
      },
    });
    const view = await service(repo).create(
      { name: "Config editing", capabilityIds: ["admin.configurations.update:all"] },
      "sa",
    );
    expect(repo.create).toHaveBeenCalled();
    expect(repo.setGrants).toHaveBeenCalledWith(
      "set-new",
      ["admin.configurations.update:all"],
      "sa",
      expect.anything(),
    );
    expect(view.capabilities.map((capability) => capability.id)).toEqual([
      "admin.configurations.update:all",
    ]);
  });

  it("refuses to grant an escalation-locked capability on update", async () => {
    const repo = new FakeRepository({ [customSet.id]: customSet });
    await expect(
      service(repo).update(customSet.id, { capabilityIds: ["admin.roles.update:all"] }, "sa"),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(repo.setGrants).not.toHaveBeenCalled();
  });

  it("updates a set's name and grants", async () => {
    const repo = new FakeRepository({ [customSet.id]: customSet });
    const view = await service(repo).update(
      customSet.id,
      { name: "Renamed", capabilityIds: ["admin.configurations.update:all"] },
      "sa",
    );
    expect(repo.updateMeta).toHaveBeenCalledWith(
      customSet.id,
      { name: "Renamed", description: undefined },
      "sa",
      expect.anything(),
    );
    expect(repo.setGrants).toHaveBeenCalledWith(
      customSet.id,
      ["admin.configurations.update:all"],
      "sa",
      expect.anything(),
    );
    expect(view.capabilities.map((capability) => capability.id)).toEqual([
      "admin.configurations.update:all",
    ]);
  });

  it("refuses to edit or delete a system set", async () => {
    const repo = new FakeRepository({ [systemSet.id]: systemSet });
    const svc = service(repo);
    await expect(svc.update(systemSet.id, { name: "x" }, "sa")).rejects.toMatchObject({
      code: "conflict",
    });
    await expect(svc.remove(systemSet.id, "sa")).rejects.toMatchObject({ code: "conflict" });
    expect(repo.softDelete).not.toHaveBeenCalled();
  });

  it("404s a missing set", async () => {
    await expect(
      service(new FakeRepository()).get("0192f3a0-7d3e-7b1a-9c2f-0000000000ff"),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("attaches a set to a custom role", async () => {
    const repo = new FakeRepository({ [customSet.id]: customSet }, { isSystem: false });
    await expect(service(repo).attach("role-1", customSet.id)).resolves.toBeUndefined();
    expect(repo.attach).toHaveBeenCalledWith("role-1", customSet.id, expect.anything());
  });

  it("refuses attaching a set to a system role", async () => {
    const repo = new FakeRepository({ [customSet.id]: customSet }, { isSystem: true });
    await expect(service(repo).attach("role-sa", customSet.id)).rejects.toMatchObject({
      code: "conflict",
    });
    expect(repo.attach).not.toHaveBeenCalled();
  });

  it("404s attaching to a missing role", async () => {
    const repo = new FakeRepository({ [customSet.id]: customSet }, null);
    await expect(service(repo).attach("role-gone", customSet.id)).rejects.toMatchObject({
      code: "not_found",
    });
    expect(repo.attach).not.toHaveBeenCalled();
  });

  it("404s detaching a set that is not attached", async () => {
    const repo = new FakeRepository();
    repo.detach = vi.fn(async () => 0);
    await expect(service(repo).detach("role-1", "set-1")).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("revokes every holder of the set's roles and audits when its grants change", async () => {
    const repo = new FakeRepository({ [customSet.id]: customSet });
    repo.userIdsWithSet = vi.fn(async () => ["u1", "u2"]);
    const { service, record, revokeAllForUser } = harness(repo);
    await service.update(customSet.id, { name: "Renamed" }, "sa");
    expect(revokeAllForUser).toHaveBeenCalledWith("u1", "permission_set_changed");
    expect(revokeAllForUser).toHaveBeenCalledWith("u2", "permission_set_changed");
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "update", entityType: "permission_set" }),
      expect.anything(),
    );
  });

  it("revokes the set's holders and audits when it is deleted", async () => {
    const repo = new FakeRepository({ [customSet.id]: customSet });
    repo.userIdsWithSet = vi.fn(async () => ["u9"]);
    const { service, record, revokeAllForUser } = harness(repo);
    await service.remove(customSet.id, "sa");
    expect(revokeAllForUser).toHaveBeenCalledWith("u9", "permission_set_deleted");
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "delete", entityType: "permission_set" }),
      expect.anything(),
    );
  });

  it("revokes the role's holders and audits on attach", async () => {
    const repo = new FakeRepository({ [customSet.id]: customSet }, { isSystem: false });
    repo.userIdsWithRole = vi.fn(async () => ["u3"]);
    const { service, record, revokeAllForUser } = harness(repo);
    await service.attach("role-1", customSet.id);
    expect(revokeAllForUser).toHaveBeenCalledWith("u3", "role_changed");
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "create", entityType: "role_permission_set" }),
      expect.anything(),
    );
  });

  it("neither audits nor revokes on a no-op re-attach", async () => {
    const repo = new FakeRepository({ [customSet.id]: customSet }, { isSystem: false });
    repo.attach = vi.fn(async () => 0);
    repo.userIdsWithRole = vi.fn(async () => ["u3"]);
    const { service, record, revokeAllForUser } = harness(repo);
    await expect(service.attach("role-1", customSet.id)).resolves.toBeUndefined();
    expect(record).not.toHaveBeenCalled();
    expect(revokeAllForUser).not.toHaveBeenCalled();
  });

  it("revokes the role's holders and audits on detach", async () => {
    const repo = new FakeRepository();
    repo.userIdsWithRole = vi.fn(async () => ["u4"]);
    const { service, record, revokeAllForUser } = harness(repo);
    await service.detach("role-1", "set-1");
    expect(revokeAllForUser).toHaveBeenCalledWith("u4", "role_changed");
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "delete", entityType: "role_permission_set" }),
      expect.anything(),
    );
  });
});
