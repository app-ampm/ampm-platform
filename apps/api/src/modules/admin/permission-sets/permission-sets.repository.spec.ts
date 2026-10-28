import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../db/prisma.service.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { PrismaPermissionSetsRepository } from "./permission-sets.repository.js";

/** A minimal transaction client exposing just the tables setGrants touches. */
function txClient(found: { id: string; capabilityKey: string }[]) {
  const createMany = vi.fn(async () => ({ count: found.length }));
  const client = {
    permissionSetGrant: { deleteMany: vi.fn(async () => ({ count: 0 })), createMany },
    grantableCapability: { findMany: vi.fn(async () => found) },
  };
  return { client: client as unknown as Prisma.TransactionClient, createMany };
}

const repo = () => new PrismaPermissionSetsRepository({} as unknown as PrismaService);

describe("PrismaPermissionSetsRepository.setGrants", () => {
  it("fails closed when the DB catalog lacks a requested capability", async () => {
    // Two distinct keys asked for, but the DB catalog has only one: it is behind the code catalog.
    const { client, createMany } = txClient([
      { id: "cap-1", capabilityKey: "admin.configurations.update:all" },
    ]);
    await expect(
      repo().setGrants(
        "set-1",
        ["admin.configurations.update:all", "tasks.tasks.read:all"],
        "sa",
        client,
      ),
    ).rejects.toThrow(/missing 1 catalog capability/);
    expect(createMany).not.toHaveBeenCalled();
  });

  it("writes one grant per distinct key when the catalog is complete", async () => {
    const { client, createMany } = txClient([
      { id: "cap-1", capabilityKey: "admin.configurations.update:all" },
    ]);
    // A duplicate key in the request collapses to a single grant row.
    await repo().setGrants(
      "set-1",
      ["admin.configurations.update:all", "admin.configurations.update:all"],
      "sa",
      client,
    );
    expect(createMany).toHaveBeenCalledWith({
      data: [{ permissionSetId: "set-1", grantableCapabilityId: "cap-1", createdBy: "sa" }],
    });
  });
});
