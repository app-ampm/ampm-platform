import { createHash } from "node:crypto";

import { errors } from "@ampm/core";
import { describe, expect, it, vi } from "vitest";

import type { AuditService } from "../../policy/audit.service.js";
import type { AvScanner } from "../../storage/av-scanner.js";
import type { ImageProcessor } from "../../storage/image.processor.js";
import type { StorageAdapter } from "../../storage/storage.types.js";
import type { DocumentsRepository, DocumentWriteData } from "./documents.repository.js";
import { DocumentsService, type StoreDocumentInput } from "./documents.service.js";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9]);
const PDF = Buffer.from("%PDF-1.7\n% a synthetic contract\n%%EOF\n");
const REENCODED = Buffer.from("the re-encoded image, without its metadata");

const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

/** A documents service over mocks, keeping the order its collaborators were called in. */
function documentsService(reencode: ImageProcessor["reencode"]) {
  const calls: string[] = [];
  const written: DocumentWriteData[] = [];
  const repo = {
    findOwned: vi.fn(async () => null),
    transaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) => work({})),
    create: vi.fn(async (data: DocumentWriteData) => {
      written.push(data);
      return { id: "doc-1", ...data.owner, versionNumber: 1 };
    }),
  } as unknown as DocumentsRepository;
  const audit = { record: vi.fn(async () => undefined) } as unknown as AuditService;
  const stored = new Map<string, Buffer>();
  const storage = {
    putObject: vi.fn(async (key: string, bytes: Buffer) => void stored.set(key, bytes)),
    deleteObject: vi.fn(async (key: string) => void stored.delete(key)),
  } as unknown as StorageAdapter;
  const scanner = {
    scan: vi.fn(async (bytes: Buffer) => {
      calls.push(`scan ${bytes.length}`);
      return "clean" as const;
    }),
  } as unknown as AvScanner;
  const images = {
    derive: vi.fn(),
    reencode: vi.fn(async (bytes: Buffer, format: "jpeg" | "png") => {
      calls.push(`reencode ${format}`);
      return reencode(bytes, format);
    }),
  } as unknown as ImageProcessor;
  const service = new DocumentsService(repo, audit, storage, scanner, images);
  return { service, calls, written, stored, images };
}

const input = (bytes: Buffer): StoreDocumentInput => ({
  owner: { ownerType: "hotel_wedding_reference", ownerId: "ref-1" },
  accountId: null,
  projectId: null,
  documentType: "consent",
  title: "Consent",
  bytes,
  previousVersionId: null,
});

const store = (service: DocumentsService, bytes: Buffer) =>
  service.store(input(bytes), "actor-1", async () => undefined);

describe("DocumentsService.store: images in documents are re-encoded (D-187 §3)", () => {
  it.each([
    ["a JPEG", JPEG, "jpeg"],
    ["a PNG", PNG, "png"],
  ] as const)(
    "scans %s as uploaded, then keeps its re-encoded bytes, size and checksum",
    async (_name, bytes, format) => {
      const { service, calls, written, stored } = documentsService(async () => REENCODED);
      await store(service, bytes);
      expect(calls).toEqual([`scan ${bytes.length}`, `reencode ${format}`]);
      expect([...stored.values()]).toEqual([REENCODED]);
      expect(written[0]).toMatchObject({
        mimeType: `image/${format}`,
        sizeBytes: REENCODED.length,
        checksum: sha256(REENCODED),
      });
    },
  );

  it("keeps a PDF as uploaded", async () => {
    const { service, written, stored, images } = documentsService(async () => REENCODED);
    await store(service, PDF);
    expect(images.reencode).not.toHaveBeenCalled();
    expect([...stored.values()]).toEqual([PDF]);
    expect(written[0]).toMatchObject({ sizeBytes: PDF.length, checksum: sha256(PDF) });
  });

  it("refuses an image it cannot decode, and keeps nothing", async () => {
    const { service, stored, written } = documentsService(async () => {
      throw new Error("VipsJpeg: premature end of JPEG image");
    });
    await expect(store(service, JPEG)).rejects.toMatchObject({
      code: "validation_failed",
      message: "The file is not a decodable image",
    });
    expect([stored.size, written.length]).toEqual([0, 0]);
  });

  it("passes the pixel-limit refusal on with its own message", async () => {
    const tooLarge = errors.validation([{ path: "file", message: "too large" }], "too large");
    const { service } = documentsService(async () => {
      throw tooLarge;
    });
    await expect(store(service, PNG)).rejects.toBe(tooLarge);
  });
});
