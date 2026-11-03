import { describe, expect, it, vi } from "vitest";

import type { AuditService } from "../../policy/audit.service.js";
import type { StorageAdapter } from "../../storage/storage.types.js";
import type { AvScanner } from "./av-scanner.js";
import type { ImageProcessor } from "./image.processor.js";
import { MediaUploadService } from "./media-upload.service.js";
import type { MediaAssetRow, MediaRepository } from "./media.repository.js";

// Sniffs as JPEG so detection passes; the image processor is mocked, so the bytes need not really decode.
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

/**
 * When an upload fails AFTER the claim is acquired (feature 9.3 slice 5c), the catch must release the claim
 * (so a retry need not wait out the stale TTL) and audit the demotion. Storage is mocked to throw once past
 * the claim; the happy-path release (via setUploaded) is covered by the media-acceptance e2e.
 */
describe("MediaUploadService release-on-failure (slice 5c)", () => {
  it("releases the claim and audits the demotion when a post-claim write throws", async () => {
    const claimUpload = vi.fn(async () => true);
    const releaseUpload = vi.fn(async () => undefined);
    const record = vi.fn(async () => undefined);
    const repo = {
      claimUpload,
      releaseUpload,
      keysOf: vi.fn(async () => ({ storageKey: "hotel/h/k", thumbnailKey: null, webKey: null })),
    } as unknown as MediaRepository;
    const audit = { record } as unknown as AuditService;
    const storage = {
      putObject: vi.fn(async () => {
        throw new Error("storage down");
      }),
    } as unknown as StorageAdapter;
    const scanner = { scan: vi.fn(async () => "clean" as const) } as unknown as AvScanner;
    const images = { derive: vi.fn(async () => Buffer.from([1])) } as unknown as ImageProcessor;
    const service = new MediaUploadService(repo, audit, storage, scanner, images);

    const asset = { kind: "image", scanStatus: "clean" } as unknown as MediaAssetRow;
    await expect(service.apply("id", asset, JPEG, "actor")).rejects.toThrow("storage down");

    expect(claimUpload).toHaveBeenCalledWith("id", "actor"); // the claim was acquired
    expect(record).toHaveBeenCalled(); // auditDemotion recorded the committed demotion
    expect(releaseUpload).toHaveBeenCalledWith("id"); // and the claim was released, not left to the TTL
  });
});
