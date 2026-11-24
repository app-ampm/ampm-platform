import { describe, expect, it, vi } from "vitest";

import type { AuditService } from "../../policy/audit.service.js";
import type { StorageAdapter } from "../../storage/storage.types.js";
import type { MediaUploadService } from "./media-upload.service.js";
import { MediaRepository, type MediaVideoRow } from "./media.repository.js";
import { MediaService } from "./media.service.js";

function build(videos: MediaVideoRow[]) {
  const repo = { listVideos: vi.fn(async () => videos) };
  const storage = {
    signDownloadUrl: vi.fn((key: string) => ({
      url: `/media/blob?key=${key}&sig=x`,
      expiresAt: new Date(0),
    })),
  };
  const service = new MediaService(
    repo as unknown as MediaRepository,
    {} as unknown as AuditService,
    storage as unknown as StorageAdapter,
    {} as unknown as MediaUploadService,
  );
  return { service, repo, storage };
}

/** The service over a repository whose live assets hold the keys `held` picks from those asked. */
function withHeldKeys(held: (keys: readonly string[]) => readonly string[]) {
  const repo = {
    heldKeys: vi.fn(async (keys: readonly string[]) => new Set(held(keys))),
    findByAnyKey: vi.fn(async (_key: string) => ({ id: "m1" })),
  };
  const service = new MediaService(
    repo as unknown as MediaRepository,
    {} as unknown as AuditService,
    {} as unknown as StorageAdapter,
    {} as unknown as MediaUploadService,
  );
  return { service, repo };
}

describe("MediaService.countUnregisteredImports (D-181)", () => {
  it("counts the (owner, ref) pairs no live asset holds yet, each once, in one read", async () => {
    const { service, repo } = withHeldKeys((keys) => keys.slice(0, 1));
    const refs = [
      { ownerId: "h1", ref: "lake.jpg" },
      { ownerId: "h1", ref: "lake.jpg" },
      { ownerId: "h1", ref: "pool.jpg" },
      { ownerId: "h2", ref: "lake.jpg" },
    ];
    expect(await service.countUnregisteredImports("hotel", refs)).toBe(2);
    expect(repo.heldKeys).toHaveBeenCalledOnce();
    expect(repo.heldKeys).toHaveBeenCalledWith([
      expect.stringMatching(/^hotel\/h1\/import-[0-9a-f]{32}$/),
      expect.stringMatching(/^hotel\/h1\/import-[0-9a-f]{32}$/),
      expect.stringMatching(/^hotel\/h2\/import-[0-9a-f]{32}$/),
    ]);
  });

  it("asks for the key registerImportedImage checks, so a preview counts what an import registers", async () => {
    const { service, repo } = withHeldKeys(() => []);
    await service.registerImportedImage("hotel", "h1", "lake.jpg", "a1");
    await service.countUnregisteredImports("hotel", [{ ownerId: "h1", ref: "lake.jpg" }]);
    expect(repo.heldKeys).toHaveBeenCalledWith([repo.findByAnyKey.mock.calls[0]?.[0]]);
  });
});

describe("MediaService.clientVideos (B17)", () => {
  it("signs each eligible video's original and never puts a storage key on the wire", async () => {
    const { service, repo, storage } = build([
      { id: "v1", caption: "A tour of the lawn", storageKey: "hotel/h1/vid1" },
      { id: "v2", caption: null, storageKey: "hotel/h1/vid2" },
    ]);
    const result = await service.clientVideos("hotel", "h1", "client");
    expect(result).toEqual([
      { id: "v1", caption: "A tour of the lawn", url: "/media/blob?key=hotel/h1/vid1&sig=x" },
      { id: "v2", caption: null, url: "/media/blob?key=hotel/h1/vid2&sig=x" },
    ]);
    for (const item of result) expect(item).not.toHaveProperty("storageKey");
    // A client sees public/demo/client media with publishable rights (the GP-20 gate lives in the query).
    expect(repo.listVideos).toHaveBeenCalledWith(
      "hotel",
      "h1",
      expect.arrayContaining(["public", "demo", "client"]),
      expect.arrayContaining(["owned", "licensed", "consent_obtained"]),
    );
    expect(storage.signDownloadUrl).toHaveBeenCalledTimes(2);
  });

  it("narrows a demo audience to public and demo media, never client", async () => {
    const { service, repo } = build([]);
    await service.clientVideos("hotel", "h1", "demo");
    // Exactly public + demo (no "client"): a demo prospect never reaches client-only media (AC-24.4).
    expect(repo.listVideos).toHaveBeenCalledWith(
      "hotel",
      "h1",
      ["public", "demo"],
      expect.arrayContaining(["owned", "licensed", "consent_obtained"]),
    );
  });
});
