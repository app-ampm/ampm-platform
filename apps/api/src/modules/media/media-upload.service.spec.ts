import { errors, UPLOAD_REFUSAL_MESSAGES } from "@ampm/core";
import { describe, expect, it, vi } from "vitest";

import type { AppLogger } from "../../common/logger.service.js";
import type { AuditService } from "../../policy/audit.service.js";
import type { StorageAdapter } from "../../storage/storage.types.js";
import type { AvScanner } from "../../storage/av-scanner.js";
import type { ImageProcessor } from "../../storage/image.processor.js";
import { writeZip } from "../documents/content/testing/zip-writer.js";
import { contentFixture } from "../documents/testing/documents-service.js";
import { MediaUploadService } from "./media-upload.service.js";
import type { MediaAssetRow, MediaRepository } from "./media.repository.js";

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as AppLogger;

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
    const service = new MediaUploadService(repo, audit, storage, scanner, images, logger);

    const asset = { kind: "image", scanStatus: "clean" } as unknown as MediaAssetRow;
    await expect(service.apply("id", asset, JPEG, "actor")).rejects.toThrow("storage down");

    expect(claimUpload).toHaveBeenCalledWith("id", "actor"); // the claim was acquired
    expect(record).toHaveBeenCalled(); // auditDemotion recorded the committed demotion
    expect(releaseUpload).toHaveBeenCalledWith("id"); // and the claim was released, not left to the TTL
  });
});

/** A service whose image processor is `derive`, with the rest mocked as far as rendering. */
function renderingService(derive: ImageProcessor["derive"], kind: "image" | "video" = "image") {
  const setUploaded = vi.fn(async (_id: string, data: Record<string, unknown>) => ({
    kind,
    ...data,
  }));
  const repo = {
    claimUpload: vi.fn(async () => true),
    keysOf: vi.fn(async () => ({ storageKey: "hotel/h/k", thumbnailKey: null, webKey: null })),
    transaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) => work({})),
    setUploaded,
  } as unknown as MediaRepository;
  const audit = { record: vi.fn() } as unknown as AuditService;
  const storage = { putObject: vi.fn(), deleteObject: vi.fn() } as unknown as StorageAdapter;
  const scanner = { scan: vi.fn(async () => "clean" as const) } as unknown as AvScanner;
  const images = { derive, reencode: vi.fn() } as unknown as ImageProcessor;
  const asset = { kind, scanStatus: "pending" } as unknown as MediaAssetRow;
  const service = new MediaUploadService(repo, audit, storage, scanner, images, logger);
  return { service, asset, scanner, derive, setUploaded };
}

/** An ISO media file: an `ftyp` box with these brands, then a little padding. */
function ftyp(major: string, compatible: readonly string[]): Buffer {
  const box = Buffer.concat([
    Buffer.alloc(8),
    Buffer.from(major, "latin1"),
    Buffer.alloc(4),
    ...compatible.map((brand) => Buffer.from(brand, "latin1")),
  ]);
  box.writeUInt32BE(box.length, 0);
  box.write("ftyp", 4, "latin1");
  return Buffer.concat([box, Buffer.alloc(64)]);
}

describe("MediaUploadService renditions (D-187 §4)", () => {
  it("derives the web rendition, then the thumbnail: one image at a time", async () => {
    let finishWeb: (web: Buffer) => void = () => undefined;
    const derive = vi
      .fn<ImageProcessor["derive"]>()
      .mockImplementationOnce(() => new Promise<Buffer>((resolve) => (finishWeb = resolve)))
      .mockImplementationOnce(async () => {
        throw new Error("vips: thumbnail failed");
      });
    const { service, asset } = renderingService(derive);
    const applying = service.apply("id", asset, JPEG, "actor");
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(derive).toHaveBeenCalledTimes(1); // the thumbnail waits for the web rendition
    finishWeb(Buffer.from([1]));
    await expect(applying).rejects.toMatchObject({
      code: "validation_failed",
      message: UPLOAD_REFUSAL_MESSAGES.image_undecodable,
      details: [{ path: "file", message: UPLOAD_REFUSAL_MESSAGES.image_undecodable }],
    });
    expect(derive.mock.calls.map(([, edge]) => edge)).toEqual([1600, 400]);
  });

  it("refuses an image over the pixel limit with the processor's own message", async () => {
    const tooLarge = errors.validation(
      [{ path: "file", message: "Images can be at most 25 megapixels" }],
      "Images can be at most 25 megapixels",
    );
    const { service, asset } = renderingService(
      vi.fn<ImageProcessor["derive"]>(async () => {
        throw tooLarge;
      }),
    );
    await expect(service.apply("id", asset, JPEG, "actor")).rejects.toBe(tooLarge);
  });
});

describe("MediaUploadService: what a media file is, by the content checks (D-187 §2)", () => {
  const noDerive = () => vi.fn<ImageProcessor["derive"]>(async () => Buffer.from([1]));

  it.each([
    ["a HEIC photo", "sips-macos-26.5.heic"],
    ["an AVIF photo", "sips-macos-26.5.avif"],
  ])("refuses %s with 415, before the scan", async (_name, file) => {
    const { service, asset, scanner } = renderingService(noDerive());
    const message = UPLOAD_REFUSAL_MESSAGES.heif_image;
    await expect(service.apply("id", asset, contentFixture(file), "actor")).rejects.toMatchObject({
      code: "unsupported_media_type",
      status: 415,
      message,
      details: [{ path: "file", message }],
    });
    expect(scanner.scan).not.toHaveBeenCalled();
  });

  it("refuses a JPEG with a ZIP behind it: a polyglot", async () => {
    const { service, asset, scanner } = renderingService(noDerive());
    const zip = writeZip([{ name: "payload.txt", data: "Sample Hotel" }]);
    const polyglot = Buffer.concat([contentFixture("pillow-12.2.0.jpg"), zip]);
    await expect(service.apply("id", asset, polyglot, "actor")).rejects.toMatchObject({
      code: "validation_failed",
      message: UPLOAD_REFUSAL_MESSAGES.polyglot,
    });
    expect(scanner.scan).not.toHaveBeenCalled();
  });

  it("refuses a video for an image asset with 415: a kind that asset does not take", async () => {
    const { service, asset } = renderingService(noDerive());
    await expect(
      service.apply("id", asset, ftyp("isom", ["isom", "mp41"]), "actor"),
    ).rejects.toMatchObject({ code: "unsupported_media_type", status: 415 });
  });

  it.each([
    ["an MP4", ftyp("isom", ["isom", "mp41"])],
    ["a QuickTime MOV (qt brand), as before", ftyp("qt  ", ["qt  "])],
  ])("takes %s for a video asset, as video/mp4", async (_name, bytes) => {
    const { service, asset, scanner, derive, setUploaded } = renderingService(noDerive(), "video");
    await service.apply("id", asset, bytes, "actor");
    expect(scanner.scan).toHaveBeenCalledWith(bytes);
    expect(derive).not.toHaveBeenCalled();
    expect(setUploaded.mock.calls[0]?.[1]).toMatchObject({
      mimeType: "video/mp4",
      scanStatus: "clean",
    });
  });
});
