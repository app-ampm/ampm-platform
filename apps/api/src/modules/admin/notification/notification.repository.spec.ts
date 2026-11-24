import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../db/prisma.service.js";
import { Prisma } from "../../../generated/prisma/client.js";
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

describe("PrismaNotificationRepository: external recipients (D-188 §5)", () => {
  it("stores an external recipient's address and the Reply-To with the new row", async () => {
    const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "n1",
      ...data,
    }));
    const repo = new PrismaNotificationRepository({
      notification: { create },
    } as unknown as PrismaService);
    await repo.create({
      recipientType: "external",
      recipientId: "request-1",
      channel: "email",
      templateKey: "hotel_form.link",
      recipientAddress: "sales@synthetic-hotel.example",
      replyTo: "desk@ampm.example",
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recipientType: "external",
        recipientAddress: "sales@synthetic-hotel.example",
        replyTo: "desk@ampm.example",
      }),
    });
  });

  it("clears the address and the Reply-To together with the render data", async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const repo = new PrismaNotificationRepository({
      notification: { updateMany },
    } as unknown as PrismaService);
    await repo.updateStatus("n1", { status: "sent", clearData: true });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "n1" },
      data: { status: "sent", data: Prisma.DbNull, recipientAddress: null, replyTo: null },
    });
    await repo.updateStatus("n1", { status: "delivered" });
    expect(updateMany).toHaveBeenLastCalledWith({
      where: { id: "n1" },
      data: { status: "delivered" },
    });
  });

  it("keeps every list to user recipients, so an external row is in no one's feed", async () => {
    const findMany = vi.fn(async () => []);
    const repo = new PrismaNotificationRepository({
      notification: { findMany },
    } as unknown as PrismaService);
    await repo.listForRecipient({ where: { deletedAt: null } }, 20);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ recipientType: "user" }) }),
    );
  });
});
