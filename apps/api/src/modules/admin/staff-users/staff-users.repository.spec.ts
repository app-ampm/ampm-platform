import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../db/prisma.service.js";
import { PrismaStaffUsersRepository } from "./staff-users.repository.js";

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: "invited" | "active" | "disabled" | "locked";
  mfaEnabled: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  roles: { role: { roleKey: string } }[];
}

function makeUsers(n: number): UserRow[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `0192f3a0-7d3e-7b1a-9c2f-00000000000${i}`,
    name: `Staff ${i}`,
    email: `staff${i}@example.com`,
    phone: null,
    status: "active" as const,
    mfaEnabled: false,
    lastLoginAt: null,
    createdAt: new Date("2026-10-28T10:00:00.000Z"),
    roles: [{ role: { roleKey: "project_manager" } }],
  }));
}

function repoWith(rows: UserRow[], count = 0) {
  const findMany = vi.fn(async () => rows);
  const countFn = vi.fn(async () => count);
  const prisma = { user: { findMany, count: countFn } } as unknown as PrismaService;
  return { repo: new PrismaStaffUsersRepository(prisma), findMany, countFn };
}

describe("PrismaStaffUsersRepository", () => {
  it("scopes the list to live staff, applies the status filter and keyset cursor, asks for limit+1", async () => {
    const { repo, findMany } = repoWith([]);
    await repo.list(50, "0192f3a0-7d3e-7b1a-9c2f-0000000000c0", "active");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userType: "staff",
          deletedAt: null,
          status: "active",
          id: { lt: "0192f3a0-7d3e-7b1a-9c2f-0000000000c0" },
        },
        orderBy: { id: "desc" },
        take: 51,
      }),
    );
  });

  it("omits the status filter and cursor when absent", async () => {
    const { repo, findMany } = repoWith([]);
    await repo.list(50, undefined, undefined);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userType: "staff", deletedAt: null }, take: 51 }),
    );
  });

  it("returns a nextCursor only when there is another page, and maps role keys", async () => {
    const more = await repoWith(makeUsers(3)).repo.list(2, undefined, undefined);
    expect(more.rows).toHaveLength(2);
    expect(more.nextCursor).toBe("0192f3a0-7d3e-7b1a-9c2f-000000000001");
    expect(more.rows[0]?.roleKeys).toEqual(["project_manager"]);

    const last = await repoWith(makeUsers(2)).repo.list(2, undefined, undefined);
    expect(last.rows).toHaveLength(2);
    expect(last.nextCursor).toBeNull();
  });

  it("emailExists reflects whether any row holds the email", async () => {
    expect(await repoWith([], 1).repo.emailExists("taken@example.com")).toBe(true);
    expect(await repoWith([], 0).repo.emailExists("free@example.com")).toBe(false);
  });
});
