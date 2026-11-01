import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../db/prisma.service.js";
import { assertNotLastSuperAdmin } from "./last-super-admin.js";

/** A Prisma stand-in whose `user.count` returns the queued values in call order (target, then others). */
function prismaWithCounts(...counts: number[]): {
  prisma: PrismaService;
  count: ReturnType<typeof vi.fn>;
} {
  const count = vi.fn();
  for (const value of counts) count.mockResolvedValueOnce(value);
  return { prisma: { user: { count } } as unknown as PrismaService, count };
}

describe("assertNotLastSuperAdmin (B3)", () => {
  it("does nothing when the target is not an active Super Admin", async () => {
    const { prisma, count } = prismaWithCounts(0);
    await expect(assertNotLastSuperAdmin(prisma, "u1")).resolves.toBeUndefined();
    expect(count).toHaveBeenCalledTimes(1); // short-circuits without counting others
  });

  it("throws when the target is the only active Super Admin", async () => {
    const { prisma } = prismaWithCounts(1, 0); // target is an active SA; no other remains
    await expect(assertNotLastSuperAdmin(prisma, "u1")).rejects.toMatchObject({ code: "conflict" });
  });

  it("allows the removal when another active Super Admin remains", async () => {
    const { prisma } = prismaWithCounts(1, 2);
    await expect(assertNotLastSuperAdmin(prisma, "u1")).resolves.toBeUndefined();
  });
});
