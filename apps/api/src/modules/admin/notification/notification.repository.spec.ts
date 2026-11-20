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

describe("PrismaNotificationRepository.recipientPhone (D-147)", () => {
  it("resolves a live user's mobile, scoped to deletedAt null, or null without one", async () => {
    const findFirst = vi.fn(async () => ({ phone: "+919876543210" }));
    const repo = new PrismaNotificationRepository({
      user: { findFirst },
    } as unknown as PrismaService);
    expect(await repo.recipientPhone("u1")).toBe("+919876543210");
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "u1", deletedAt: null },
      select: { phone: true },
    });
    const none = new PrismaNotificationRepository({
      user: { findFirst: vi.fn(async () => ({ phone: null })) },
    } as unknown as PrismaService);
    expect(await none.recipientPhone("u2")).toBeNull();
  });
});

describe("PrismaNotificationRepository.listForRecipient", () => {
  it("leaves security messages (auth.*) out of every feed (D-147)", async () => {
    const findMany = vi.fn(async () => []);
    const repo = new PrismaNotificationRepository({
      notification: { findMany },
    } as unknown as PrismaService);
    await repo.listForRecipient({ where: { deletedAt: null }, ownerId: "u1" }, 20);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ NOT: { templateKey: { startsWith: "auth." } } }),
      }),
    );
  });
});
