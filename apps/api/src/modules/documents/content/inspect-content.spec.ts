import { CONTENT_KINDS, type ContentKind } from "@ampm/core";
import { describe, expect, it } from "vitest";

import { inspectContent, MAX_INSPECTED_BYTES } from "./inspect-content.js";
import { buildPackage } from "./testing/ooxml-builder.js";
import { pptFile, xlsFile } from "./testing/office-records.js";
import { buildPdf } from "./testing/pdf-builder.js";
import { EVERY_KIND } from "./testing/refusals.js";
import { writeZip } from "./testing/zip-writer.js";
import { writeCompoundFile } from "./testing/cfb-writer.js";

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 0x41)]);
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(100),
]);
const ftyp = (major: string, brands: string[]): Buffer => {
  const box = Buffer.concat([
    Buffer.alloc(8),
    Buffer.from(major),
    Buffer.alloc(4),
    ...brands.map((b) => Buffer.from(b)),
  ]);
  box.writeUInt32BE(box.length, 0);
  box.write("ftyp", 4, "latin1");
  return Buffer.concat([box, Buffer.alloc(64)]);
};
const MP4 = ftyp("isom", ["isom", "mp41"]);
const HEIC = ftyp("heic", ["mif1", "heic"]);

const FACT_SHEET = new Set<ContentKind>(["pdf", "pptx", "ppsx", "potx", "ppt"]);
const MENU = new Set<ContentKind>(["pdf", "jpeg", "png", "xlsx", "xltx", "xls"]);
const FLOOR_PLAN = new Set<ContentKind>(["pdf", "jpeg", "png"]);
const MEDIA = new Set<ContentKind>(["jpeg", "png", "webp", "gif", "mp4"]);

describe("inspectContent: the kind by content (D-187 §2 and §3)", () => {
  it.each<[string, Buffer, ReadonlySet<ContentKind>, ContentKind]>([
    ["a PDF fact sheet", buildPdf(), FACT_SHEET, "pdf"],
    ["a pptx fact sheet", buildPackage({ kind: "pptx" }), FACT_SHEET, "pptx"],
    ["a ppsx fact sheet", buildPackage({ kind: "ppsx" }), FACT_SHEET, "ppsx"],
    ["an older ppt fact sheet", pptFile(), FACT_SHEET, "ppt"],
    ["an xlsx menu", buildPackage({ kind: "xlsx" }), MENU, "xlsx"],
    ["an older xls menu", xlsFile(), MENU, "xls"],
    ["a JPEG menu card", JPEG, MENU, "jpeg"],
    ["a PNG floor plan", PNG, FLOOR_PLAN, "png"],
    ["an MP4 video", MP4, MEDIA, "mp4"],
  ])("accepts %s", async (_name, bytes, accepted, kind) => {
    expect(await inspectContent(bytes, accepted)).toEqual({ ok: true, kind });
    expect(CONTENT_KINDS[kind].mimeType).toMatch(/\//);
  });

  it.each<[string, Buffer, ReadonlySet<ContentKind>, string]>([
    ["an executable", Buffer.from("MZ\x90\x00 Sample Hotel"), EVERY_KIND, "unknown_type"],
    ["an empty file", Buffer.alloc(0), EVERY_KIND, "unknown_type"],
    ["a workbook as a fact sheet", buildPackage({ kind: "xlsx" }), FACT_SHEET, "type_not_accepted"],
    ["a JPEG as a fact sheet", JPEG, FACT_SHEET, "type_not_accepted"],
    ["a PDF in the photo library", buildPdf(), MEDIA, "type_not_accepted"],
    ["a docx", buildPackage({ kind: "docx" }), MENU, "word_document"],
    [
      "a Word .doc",
      writeCompoundFile([{ name: "WordDocument", data: Buffer.alloc(600) }]),
      FLOOR_PLAN,
      "word_document",
    ],
    ["a docx in the photo library", buildPackage({ kind: "docx" }), MEDIA, "type_not_accepted"],
    ["an iPhone HEIC photo", HEIC, MENU, "heif_image"],
    ["a HEIC photo as a fact sheet", HEIC, FACT_SHEET, "type_not_accepted"],
    [
      "a plain ZIP",
      writeZip([{ name: "a.txt", data: "Sample Hotel" }]),
      EVERY_KIND,
      "unknown_type",
    ],
    [
      "a JPEG with a ZIP behind it",
      Buffer.concat([JPEG, writeZip([{ name: "a.txt", data: "x" }])]),
      EVERY_KIND,
      "polyglot",
    ],
    [
      "a PNG with a PDF inside",
      Buffer.concat([PNG, Buffer.from("%PDF-1.4 ")]),
      EVERY_KIND,
      "polyglot",
    ],
    [
      "a PDF with JavaScript",
      buildPdf({ catalog: "/OpenAction << /S /JavaScript /JS (x) >>" }),
      FACT_SHEET,
      "pdf_active_content",
    ],
    ["a pptm", buildPackage({ kind: "pptm" }), FACT_SHEET, "macros"],
    ["an xls with a macro sheet", xlsFile({ extraSheetType: 0x01 }), MENU, "macros"],
    ["an encrypted ppt", pptFile({ encryptedHeader: true }), FACT_SHEET, "password_protected"],
  ])("refuses %s", async (_name, bytes, accepted, reason) => {
    const result = await inspectContent(bytes, accepted);
    expect(result).toMatchObject({ ok: false, reason });
    expect(result.ok ? "" : result.detail.length).toBeGreaterThan(0);
  });

  it("refuses a file over the largest upload before reading it", async () => {
    const huge = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(MAX_INSPECTED_BYTES)]);
    expect(await inspectContent(huge, EVERY_KIND)).toMatchObject({
      ok: false,
      reason: "too_large",
    });
  });

  it("fails closed: an error the rules did not foresee is a refusal", async () => {
    const truncated = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    expect(await inspectContent(truncated, EVERY_KIND)).toMatchObject({
      ok: false,
      reason: "file_damaged",
    });
  });
});
