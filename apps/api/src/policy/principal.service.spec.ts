import { describe, expect, it } from "vitest";

import { PrincipalService } from "./principal.service.js";
import { PrincipalRepository, type PrincipalRecord } from "./principal.repository.js";

class FakeRepository extends PrincipalRepository {
  touched: string[] = [];
  constructor(private readonly records: PrincipalRecord[]) {
    super();
  }
  findByIdentitySubject(subject: string): Promise<PrincipalRecord | null> {
    return Promise.resolve(this.records.find((r) => r.email === `${subject}@example.com`) ?? null);
  }
  touchLastLogin(userId: string): Promise<void> {
    this.touched.push(userId);
    return Promise.resolve();
  }
}

const record = (overrides: Partial<PrincipalRecord>): PrincipalRecord => ({
  id: "0192f3a0-7d3e-7b1a-9c2f-000000000001",
  userType: "staff",
  name: "Asha",
  email: "admin@example.com",
  phone: null,
  status: "active",
  lastLoginAt: null,
  roleKeys: ["super_admin"],
  memberships: [],
  ...overrides,
});

describe("PrincipalService", () => {
  it("turns a staff record into a staff principal with role codes", async () => {
    const repo = new FakeRepository([record({})]);
    const principal = await new PrincipalService(repo).resolve({
      subject: "admin",
      provider: "local",
      email: null,
      phone: null,
    });
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
      record({
        email: "client@example.com",
        userType: "client",
        roleKeys: [],
        memberships: [member],
      }),
    ]);
    const principal = await new PrincipalService(repo).resolve({
      subject: "client",
      provider: "local",
      email: null,
      phone: null,
    });
    expect(principal.type).toBe("client");
    if (principal.type === "client")
      expect(principal.entitlements.modules).toContain("wedding_workspace");
  });

  it("refuses unknown subjects and inactive accounts", async () => {
    const repo = new FakeRepository([
      record({ email: "disabled@example.com", status: "disabled" }),
    ]);
    const service = new PrincipalService(repo);
    await expect(
      service.resolve({ subject: "nobody", provider: "local", email: null, phone: null }),
    ).rejects.toMatchObject({ code: "unauthenticated" });
    await expect(
      service.resolve({ subject: "disabled", provider: "local", email: null, phone: null }),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });
});
