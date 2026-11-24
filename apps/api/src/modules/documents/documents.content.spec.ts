import { randomBytes } from "node:crypto";

import { CONTENT_KINDS, UPLOAD_REFUSAL_MESSAGES, type DocumentType } from "@ampm/core";
import { describe, expect, it } from "vitest";

import { buildPackage, TRANSITIONAL_RELS } from "./content/testing/ooxml-builder.js";
import { buildPdf } from "./content/testing/pdf-builder.js";
import { contentFixture, documentsHarness, storeInput } from "./testing/documents-service.js";

const MIB = 1024 * 1024;

/** A refusal as the route answers it: the code, the core message, and the message on the file. */
function refusal(code: string, message: string) {
  return { code, message, details: [{ path: "file", message }] };
}

const store = (bytes: Buffer, type: DocumentType, harness = documentsHarness()) =>
  harness.service.store(storeInput(bytes, type), "actor-1", async () => undefined);

describe("DocumentsService.store: each type takes its own kinds (D-187 §3)", () => {
  it.each<[string, string, DocumentType, keyof typeof CONTENT_KINDS]>([
    ["a Keynote pptx as a fact sheet", "keynote-14.4.pptx", "fact_sheet", "pptx"],
    ["a Numbers xlsx as a food menu", "numbers-14.4.xlsx", "menu", "xlsx"],
    ["a Numbers xlsx as a beverage menu", "numbers-14.4.xlsx", "beverage_menu", "xlsx"],
    ["a PDF floor plan", "reportlab-5.0.0-plain.pdf", "floor_plan", "pdf"],
    [
      "a permission-locked PDF contract (D-185)",
      "pypdf-6.13.3-rc4-128-owner-only.pdf",
      "contract",
      "pdf",
    ],
  ])("takes %s, stored under the detected kind's type", async (_name, file, type, kind) => {
    const harness = documentsHarness();
    const bytes = contentFixture(file);
    await store(bytes, type, harness);
    const mimeType = CONTENT_KINDS[kind].mimeType;
    expect(harness.calls).toEqual([`scan ${bytes.length}`, `put ${mimeType}`]);
    expect(harness.written[0]).toMatchObject({
      documentType: type,
      mimeType,
      sizeBytes: bytes.length,
    });
  });

  it("refuses a Word file with 415 and the save-as-PDF message, before the scan", async () => {
    const harness = documentsHarness();
    await expect(
      store(contentFixture("pages-14.4.docx"), "fact_sheet", harness),
    ).rejects.toMatchObject({
      ...refusal("unsupported_media_type", UPLOAD_REFUSAL_MESSAGES.word_document),
      status: 415,
    });
    expect(UPLOAD_REFUSAL_MESSAGES.word_document).toContain("save it as a PDF");
    expect([harness.calls, harness.written, harness.stored.size]).toEqual([[], [], 0]);
  });

  it.each<[string, Buffer, DocumentType]>([
    ["a presentation as a floor plan", contentFixture("keynote-14.4.pptx"), "floor_plan"],
    ["a workbook as a contract", contentFixture("numbers-14.4.xlsx"), "contract"],
    ["a workbook as a fact sheet", contentFixture("numbers-14.4.xlsx"), "fact_sheet"],
    ["a WebP photo as a menu", contentFixture("pillow-12.2.0.webp"), "menu"],
    ["a HEIC photo as a floor plan", contentFixture("sips-macos-26.5.heic"), "floor_plan"],
  ])("refuses %s with 415: a kind the type does not take", async (_name, bytes, type) => {
    const harness = documentsHarness();
    await expect(store(bytes, type, harness)).rejects.toMatchObject({
      code: "unsupported_media_type",
      status: 415,
    });
    expect(harness.calls).toEqual([]);
  });

  it.each<[string, Buffer, DocumentType, keyof typeof UPLOAD_REFUSAL_MESSAGES]>([
    ["a macro-enabled presentation", buildPackage({ kind: "pptm" }), "fact_sheet", "macros"],
    ["a macro-enabled workbook", buildPackage({ kind: "xlsm" }), "menu", "macros"],
    [
      "a PDF with JavaScript",
      contentFixture("pypdf-6.13.3-javascript.pdf"),
      "contract",
      "pdf_active_content",
    ],
    [
      "a PDF that needs a password to open",
      contentFixture("pypdf-6.13.3-rc4-128-user-password.pdf"),
      "contract",
      "password_protected",
    ],
  ])("refuses %s with 400 and its own message", async (_name, bytes, type, reason) => {
    const harness = documentsHarness();
    await expect(store(bytes, type, harness)).rejects.toMatchObject(
      refusal("validation_failed", UPLOAD_REFUSAL_MESSAGES[reason]),
    );
    expect(harness.calls).toEqual([]);
  });
});

describe("DocumentsService.store: the kind's cap, after the checks and before the scan", () => {
  // A workbook just over its 10 MiB cap: random bytes stay that size however they are packed.
  const bigWorkbook = () =>
    buildPackage({
      kind: "xlsx",
      defaults: { png: "image/png" },
      parts: [{ name: "xl/media/image1.png", data: randomBytes(10 * MIB + 4096) }],
    });

  it("refuses a workbook menu over 10 MiB with 413, naming the limit", async () => {
    const harness = documentsHarness();
    const message = "The file is larger than 10 MB, the limit for this type of file.";
    await expect(store(bigWorkbook(), "menu", harness)).rejects.toMatchObject({
      code: "payload_too_large",
      status: 413,
      message,
      details: [{ path: "file", message }],
    });
    expect(harness.calls).toEqual([]);
  });

  it("takes a PDF menu of the same size: a PDF's cap is 20 MiB", async () => {
    const harness = documentsHarness();
    await store(buildPdf({ tail: Buffer.alloc(10 * MIB + 4096, 0x20) }), "menu", harness);
    expect(harness.written).toHaveLength(1);
  });

  it("refuses a PDF over 20 MiB as a fact sheet, where a presentation may be 25 MiB", async () => {
    const harness = documentsHarness();
    const pdf = buildPdf({ tail: Buffer.alloc(20 * MIB + 1, 0x20) });
    await expect(store(pdf, "fact_sheet", harness)).rejects.toMatchObject({
      code: "payload_too_large",
      message: "The file is larger than 20 MB, the limit for this type of file.",
    });
  });
});

describe("DocumentsService.store: a refusal is logged without the file's contents", () => {
  it("logs the reason and the rule, with any name or address from the file masked", async () => {
    const harness = documentsHarness();
    const linked = buildPackage({
      kind: "pptx",
      relationships: [
        {
          source: "ppt/slides/slide1.xml",
          type: `${TRANSITIONAL_RELS}/image`,
          target: "file:///C:/Users/Asha%20Rao/Pictures/lawn.jpg",
          external: true,
        },
      ],
    });
    await expect(store(linked, "fact_sheet", harness)).rejects.toMatchObject({
      code: "validation_failed",
    });
    expect(harness.logged).toHaveLength(1);
    const [entry] = harness.logged;
    expect(entry).toMatchObject({
      event: "upload.refused",
      fields: { reason: "external_content", documentType: "fact_sheet", ownerType: "hotel" },
    });
    expect(String(entry?.fields["detail"])).toMatch(/external/);
    expect(JSON.stringify(entry)).not.toMatch(/Asha|Users|lawn/);
  });
});
