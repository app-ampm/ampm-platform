import { describe, expect, it, vi } from "vitest";

import type { AuditService } from "../../policy/audit.service.js";
import { DocumentVersionsService } from "./document-versions.service.js";
import type { DocumentRow, DocumentsRepository } from "./documents.repository.js";

const OWNER = { ownerType: "hotel", ownerId: "0192f1a0-0000-7000-8000-0000000000a1" };

const version = (id: string, previousVersionId: string | null, minute: number) =>
  ({
    id,
    ...OWNER,
    title: "Fact sheet",
    documentType: "fact_sheet",
    mimeType: "application/pdf",
    sizeBytes: 10,
    versionNumber: previousVersionId ? 2 : 1,
    previousVersionId,
    visibility: "internal",
    uploadedBy: "actor-1",
    createdAt: new Date(Date.UTC(2026, 10, 24, 10, minute)),
  }) as DocumentRow;

/** The service over a repository holding `rows`, recording what it soft-deletes and audits. */
function versionsService(
  rows: DocumentRow[],
  options: { locked?: boolean; followed?: boolean } = {},
) {
  const deleted: string[] = [];
  const repo = {
    listByOwner: vi.fn(async () => rows),
    lockOwned: vi.fn(async () => options.locked ?? true),
    hasSuccessor: vi.fn(async () => options.followed ?? false),
    softDelete: vi.fn(async (ids: string[]) => {
      deleted.push(...ids);
      return ids.length;
    }),
    transaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) => work({})),
  } as unknown as DocumentsRepository;
  const record = vi.fn<(event: { action: string; entityId: string }) => Promise<void>>(
    async () => undefined,
  );
  const audit = { record } as unknown as AuditService;
  return { service: new DocumentVersionsService(repo, audit), deleted, record };
}

const V1 = version("v1", null, 1);
const V2 = version("v2", "v1", 2);

describe("DocumentVersionsService (D-187 §6)", () => {
  it("finds a live document by its latest version, with the versions it replaced", async () => {
    const { service } = versionsService([V2, V1]);
    expect(await service.requireLatest("v2", OWNER)).toEqual({ latest: V2, earlier: [V1] });
  });

  it("answers an earlier version 409 and an unknown one 404", async () => {
    const { service } = versionsService([V2, V1]);
    await expect(service.requireLatest("v1", OWNER)).rejects.toMatchObject({ status: 409 });
    await expect(service.requireLatest("v9", OWNER)).rejects.toMatchObject({ status: 404 });
  });

  it("refuses to follow a document that is gone (404) or already followed (409)", async () => {
    await expect(
      versionsService([V1], { locked: false }).service.lockLatest("v1", OWNER, "v2", {} as never),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      versionsService([V1], { followed: true }).service.lockLatest("v1", OWNER, "v2", {} as never),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("removes a document with every version, auditing each row", async () => {
    const { service, deleted, record } = versionsService([V2, V1]);
    await service.removeWithVersions("v2", OWNER, "actor-1");
    expect(deleted).toEqual(["v2", "v1"]);
    expect(record.mock.calls.map(([event]) => [event.action, event.entityId])).toEqual([
      ["delete", "v2"],
      ["delete", "v1"],
    ]);
  });

  it("removes nothing when the document was replaced meanwhile", async () => {
    const { service, deleted } = versionsService([V2, V1], { followed: true });
    await expect(service.removeWithVersions("v2", OWNER, "actor-1")).rejects.toMatchObject({
      status: 409,
    });
    expect(deleted).toEqual([]);
  });
});
