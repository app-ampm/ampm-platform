import { createHash } from "node:crypto";

import { errors, UPLOAD_REFUSAL_MESSAGES } from "@ampm/core";
import { describe, expect, it } from "vitest";

import { IMAGE_TIMEOUT_MESSAGE } from "../../storage/image.processor.js";
import type { DocumentsService } from "./documents.service.js";
import { documentsHarness, storeInput } from "./testing/documents-service.js";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9]);
const PDF = Buffer.from("%PDF-1.7\n% a synthetic contract\n%%EOF\n");
const REENCODED = Buffer.from("the re-encoded image, without its metadata");

const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

const store = (service: DocumentsService, bytes: Buffer) =>
  service.store(storeInput(bytes, "consent"), "actor-1", async () => undefined);

describe("DocumentsService.store: images in documents are re-encoded (D-187 §3)", () => {
  it.each([
    ["a JPEG", JPEG, "jpeg"],
    ["a PNG", PNG, "png"],
  ] as const)(
    "scans %s as uploaded, then keeps its re-encoded bytes, size and checksum",
    async (_name, bytes, format) => {
      const { service, calls, written, stored } = documentsHarness({
        reencode: async () => REENCODED,
      });
      await store(service, bytes);
      expect(calls).toEqual([`scan ${bytes.length}`, `reencode ${format}`, `put image/${format}`]);
      expect([...stored.values()]).toEqual([REENCODED]);
      expect(written[0]).toMatchObject({
        mimeType: `image/${format}`,
        sizeBytes: REENCODED.length,
        checksum: sha256(REENCODED),
      });
    },
  );

  it("keeps a PDF as uploaded", async () => {
    const { service, written, stored, images } = documentsHarness({
      reencode: async () => REENCODED,
    });
    await store(service, PDF);
    expect(images.reencode).not.toHaveBeenCalled();
    expect([...stored.values()]).toEqual([PDF]);
    expect(written[0]).toMatchObject({ sizeBytes: PDF.length, checksum: sha256(PDF) });
  });

  it("refuses an image it cannot decode in the core message, and keeps nothing", async () => {
    const { service, stored, written } = documentsHarness({
      reencode: async () => {
        throw new Error("VipsJpeg: premature end of JPEG image");
      },
    });
    const message = UPLOAD_REFUSAL_MESSAGES.image_undecodable;
    await expect(store(service, JPEG)).rejects.toMatchObject({
      code: "validation_failed",
      message,
      details: [{ path: "file", message }],
    });
    expect([stored.size, written.length]).toEqual([0, 0]);
  });

  it("passes the pixel-limit refusal on with its own message", async () => {
    const tooLarge = errors.validation([{ path: "file", message: "too large" }], "too large");
    const { service } = documentsHarness({
      reencode: async () => {
        throw tooLarge;
      },
    });
    await expect(store(service, PNG)).rejects.toBe(tooLarge);
  });

  it("passes an image queue that ran out of time on as its 503, and keeps nothing", async () => {
    const timedOut = errors.unavailable(IMAGE_TIMEOUT_MESSAGE);
    const { service, stored, written } = documentsHarness({
      reencode: async () => {
        throw timedOut;
      },
    });
    await expect(store(service, PNG)).rejects.toMatchObject({ status: 503, code: "unavailable" });
    expect([stored.size, written.length]).toEqual([0, 0]);
  });

  it("refuses an infected file after the checks, and keeps nothing", async () => {
    const { service, calls, stored } = documentsHarness({ verdict: "rejected" });
    await expect(store(service, PDF)).rejects.toMatchObject({
      code: "validation_failed",
      message: "The file failed the antivirus scan and was not stored",
    });
    expect([calls, stored.size]).toEqual([[`scan ${PDF.length}`], 0]);
  });
});
