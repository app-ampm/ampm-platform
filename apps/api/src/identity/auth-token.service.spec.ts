import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../db/prisma.service.js";
import { AuthTokenService } from "./auth-token.service.js";

function sha256(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

interface CreateArg {
  data: { userId: string; purpose: string; tokenHash: string; expiresAt: Date };
}

function prismaMock() {
  const updateMany = vi.fn(async () => ({ count: 0 }));
  const create = vi.fn(async (_arg: CreateArg) => ({ id: "t1" }));
  const findFirst = vi.fn(async () => null as { id: string; userId: string } | null);
  const prisma = { authToken: { updateMany, create, findFirst } } as unknown as PrismaService;
  return { prisma, updateMany, create, findFirst };
}

describe("AuthTokenService", () => {
  it("issues a single live invite, storing only the hash and returning the raw token", async () => {
    const { prisma, updateMany, create } = prismaMock();
    const raw = await new AuthTokenService(prisma).issueInvite("u1");
    expect(raw).toMatch(/.+/);
    // Any prior live invite for the user is retired first.
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u1", purpose: "invite", usedAt: null },
        data: { usedAt: expect.any(Date) },
      }),
    );
    // Only the sha256 of the returned raw token is stored.
    const data = create.mock.calls[0]?.[0]?.data;
    expect(data).toMatchObject({ userId: "u1", purpose: "invite", tokenHash: sha256(raw) });
    expect(data?.tokenHash ?? "").not.toContain(raw);
    expect(data?.expiresAt?.getTime() ?? 0).toBeGreaterThan(Date.now());
  });

  it("looks a valid invite up by the token's hash", async () => {
    const { prisma, findFirst } = prismaMock();
    findFirst.mockResolvedValueOnce({ id: "t1", userId: "u1" });
    const found = await new AuthTokenService(prisma).findValidInvite("the-raw-token");
    expect(found).toEqual({ id: "t1", userId: "u1" });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          purpose: "invite",
          tokenHash: sha256("the-raw-token"),
          usedAt: null,
        }),
      }),
    );
  });

  it("claims a live invite atomically, reporting whether this call won", async () => {
    const { prisma, updateMany } = prismaMock();
    updateMany.mockResolvedValueOnce({ count: 1 });
    expect(await new AuthTokenService(prisma).markUsedIfLive("t1")).toBe(true);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "t1", usedAt: null },
        data: { usedAt: expect.any(Date) },
      }),
    );
  });

  it("does not claim an invite another request already used", async () => {
    const { prisma, updateMany } = prismaMock();
    updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await new AuthTokenService(prisma).markUsedIfLive("t1")).toBe(false);
  });
});
