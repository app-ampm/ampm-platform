import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../db/prisma.service.js";
import { PrismaNotificationRepository } from "./notification.repository.js";

describe("PrismaNotificationRepository.recipientEmail", () => {
  it("resolves a live user's email, scoped to deletedAt null", async () => {
    const findFirst = vi.fn(async () => ({ email: "pat@example.com" }));
    const prisma = { user: { findFirst } } as unknown as PrismaService;
    const repo = new PrismaNotificationRepository(prisma);

    expect(await repo.recipientEmail("u1")).toBe("pat@example.com");
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "u1", deletedAt: null },
      select: { email: true },
    });
  });

  it("returns null for a deleted or absent user", async () => {
    const prisma = {
      user: { findFirst: vi.fn(async () => null) },
    } as unknown as PrismaService;
    const repo = new PrismaNotificationRepository(prisma);

    expect(await repo.recipientEmail("missing")).toBeNull();
  });
});
