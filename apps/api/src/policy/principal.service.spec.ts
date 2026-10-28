import { decide } from "@ampm/policy";
import { describe, expect, it } from "vitest";

import type { AppLogger } from "../common/logger.service.js";
import type { Env } from "../env.js";
import { PrincipalRepository, type PrincipalRecord } from "./principal.repository.js";
import { PrincipalService } from "./principal.service.js";
import { toPolicyPrincipal } from "./principal.types.js";

class FakeRepository extends PrincipalRepository {
  touched: string[] = [];
  constructor(
    private readonly records: PrincipalRecord[],
    private readonly caps: Readonly<Record<string, readonly string[]>> = {},
  ) {
    super();
  }
  findByIdentitySubject(subject: string): Promise<PrincipalRecord | null> {
    return Promise.resolve(this.records.find((r) => r.email === `${subject}@example.com`) ?? null);
  }
  touchLastLogin(userId: string): Promise<void> {
    this.touched.push(userId);
    return Promise.resolve();
  }
  capabilityKeysForRoles(roleIds: readonly string[]): Promise<string[]> {
    const keys = new Set<string>();
    for (const id of roleIds) for (const key of this.caps[id] ?? []) keys.add(key);
    return Promise.resolve([...keys]);
  }
}

const env = (dynamicRoles: boolean): Env => ({ DYNAMIC_ROLES: dynamicRoles }) as unknown as Env;
const logger = { warn: () => undefined } as unknown as AppLogger;
const service = (repo: FakeRepository, dynamicRoles = false) =>
  new PrincipalService(repo, env(dynamicRoles), logger);

const identity = (subject: string) => ({
  subject,
  provider: "local" as const,
  tokenId: "jti-test",
  email: null,
  phone: null,
});

const record = (overrides: Partial<PrincipalRecord>): PrincipalRecord => ({
  id: "0192f3a0-7d3e-7b1a-9c2f-000000000001",
  userType: "staff",
  name: "Asha",
  email: "admin@example.com",
  phone: null,
  status: "active",
  lastLoginAt: null,
  roles: [{ roleKey: "super_admin", roleId: "r-sa", isSystem: true }],
  memberships: [],
  ...overrides,
});

describe("PrincipalService", () => {
  it("turns a staff record into a staff principal with role codes", async () => {
    const repo = new FakeRepository([record({})]);
    const principal = await service(repo).resolve(identity("admin"));
    expect(principal).toMatchObject({ type: "staff", roles: ["SA"] });
    expect(repo.touched).toHaveLength(1);
  });

  it("gives a client principal entitlements from its memberships", async () => {
    const member = {
      projectId: "0192f3a0-7d3e-7b1a-9c2f-0000000000a1",
      projectRole: "client_representative" as const,
      clientSide: "bride" as const,
      canViewFinance: true,
      canApprove: true,
    };
    const repo = new FakeRepository([
      record({ email: "client@example.com", userType: "client", roles: [], memberships: [member] }),
    ]);
    const principal = await service(repo).resolve(identity("client"));
    expect(principal.type).toBe("client");
    if (principal.type === "client")
      expect(principal.entitlements.modules).toContain("wedding_workspace");
  });

  it("refuses unknown subjects and inactive accounts", async () => {
    const repo = new FakeRepository([
      record({ email: "disabled@example.com", status: "disabled" }),
    ]);
    const svc = service(repo);
    await expect(svc.resolve(identity("nobody"))).rejects.toMatchObject({
      code: "unauthenticated",
    });
    await expect(svc.resolve(identity("disabled"))).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  const customRecord = record({
    email: "custom@example.com",
    roles: [{ roleKey: "custom_cfg", roleId: "r-custom", isSystem: false }],
  });
  const caps = { "r-custom": ["admin.configurations.update:all"] };

  it("drops a custom role when DYNAMIC_ROLES is off (the pre-flag behaviour)", async () => {
    const repo = new FakeRepository([customRecord], caps);
    const principal = await service(repo, false).resolve(identity("custom"));
    expect(principal).toMatchObject({ type: "staff", roles: [], resolvedGrants: undefined });
    expect(decide(toPolicyPrincipal(principal), "admin.configurations.update").allowed).toBe(false);
  });

  it("resolves a custom role's capabilities into enforced grants when the flag is on", async () => {
    const repo = new FakeRepository([customRecord], caps);
    const principal = await service(repo, true).resolve(identity("custom"));
    expect(principal.type).toBe("staff");
    if (principal.type !== "staff") return;
    expect(principal.roles).toEqual([]);
    expect(principal.resolvedGrants?.has("admin.configurations.update")).toBe(true);
    expect(decide(toPolicyPrincipal(principal), "admin.configurations.update").allowed).toBe(true);
    // A capability the custom role was not granted stays denied.
    expect(decide(toPolicyPrincipal(principal), "admin.roles.update").allowed).toBe(false);
  });

  it("keeps the system roles while adding a custom role's grants", async () => {
    const mixed = record({
      email: "mixed@example.com",
      roles: [
        { roleKey: "sales", roleId: "r-sm", isSystem: true },
        { roleKey: "custom_cfg", roleId: "r-custom", isSystem: false },
      ],
    });
    const principal = await service(new FakeRepository([mixed], caps), true).resolve(
      identity("mixed"),
    );
    if (principal.type !== "staff") throw new Error("expected staff");
    expect(principal.roles).toEqual(["SM"]);
    expect(principal.resolvedGrants?.has("admin.configurations.update")).toBe(true);
  });

  it("does not grant a non-system role that reused a reserved key the matrix role's power", async () => {
    // isSystem=false, so even though the key matches a system code it resolves through its own grants.
    const impostor = record({
      email: "impostor@example.com",
      roles: [{ roleKey: "super_admin", roleId: "r-impostor", isSystem: false }],
    });
    const principal = await service(new FakeRepository([impostor], {}), true).resolve(
      identity("impostor"),
    );
    if (principal.type !== "staff") throw new Error("expected staff");
    expect(principal.roles).toEqual([]);
    expect(decide(toPolicyPrincipal(principal), "admin.roles.update").allowed).toBe(false);
  });
});
