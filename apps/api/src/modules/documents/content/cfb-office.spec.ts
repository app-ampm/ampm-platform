import { describe, expect, it } from "vitest";

import { inspectCompoundFile, walkPptRecords } from "./cfb-office.js";
import type { ContentKind } from "./kinds.js";
import { writeCompoundFile } from "./testing/cfb-writer.js";
import {
  currentUserStream,
  pptFile,
  pptRecord,
  presentationStream,
  xlsFile,
} from "./testing/office-records.js";
import { EVERY_KIND, refusalOf } from "./testing/refusals.js";

const SLIDES_ONLY = new Set<ContentKind>(["pdf", "pptx", "ppt"]);
const PHOTOS = new Set<ContentKind>(["jpeg", "png"]);

describe("inspectCompoundFile: the main stream decides the kind (D-187 §2)", () => {
  it("reads a workbook as xls and a presentation as ppt", () => {
    expect(inspectCompoundFile(xlsFile(), EVERY_KIND)).toBe("xls");
    expect(inspectCompoundFile(pptFile(), EVERY_KIND)).toBe("ppt");
  });

  it.each<[string, Buffer, ReadonlySet<ContentKind>, string]>([
    [
      "a Word document",
      writeCompoundFile([{ name: "WordDocument", data: Buffer.alloc(600) }]),
      EVERY_KIND,
      "word_document",
    ],
    [
      "a Word document where PDFs are not taken",
      writeCompoundFile([{ name: "WordDocument", data: Buffer.alloc(600) }]),
      PHOTOS,
      "type_not_accepted",
    ],
    [
      "both main streams",
      writeCompoundFile([
        { name: "Workbook", data: Buffer.alloc(600) },
        { name: "PowerPoint Document", data: Buffer.alloc(600) },
      ]),
      EVERY_KIND,
      "polyglot",
    ],
    [
      "neither main stream (an installer, an email)",
      writeCompoundFile([{ name: "Contents", data: Buffer.alloc(600) }]),
      EVERY_KIND,
      "unknown_type",
    ],
    ["an xls where only slides are taken", xlsFile(), SLIDES_ONLY, "type_not_accepted"],
    [
      "a main stream that is a storage",
      writeCompoundFile([{ name: "Workbook", children: [] }]),
      EVERY_KIND,
      "file_damaged",
    ],
  ])("refuses %s", async (_name, bytes, accepted, reason) => {
    expect((await refusalOf(() => inspectCompoundFile(bytes, accepted))).reason).toBe(reason);
  });
});

describe("inspectCompoundFile: encryption, macros and macro sheets", () => {
  it.each<[string, Buffer, string]>([
    [
      "an encrypted OOXML package (EncryptionInfo, EncryptedPackage)",
      writeCompoundFile([
        { name: "EncryptionInfo", data: Buffer.alloc(200) },
        { name: "EncryptedPackage", data: Buffer.alloc(9000) },
      ]),
      "password_protected",
    ],
    ["a workbook with FILEPASS", xlsFile({ filePass: true }), "password_protected"],
    [
      "a presentation with an encrypted current-user header",
      pptFile({ encryptedHeader: true }),
      "password_protected",
    ],
    ["a presentation with a crypt session", pptFile({ cryptSession: true }), "password_protected"],
    [
      "a workbook with a VBA storage",
      xlsFile({}, [{ name: "_VBA_PROJECT_CUR", children: [{ name: "VBA", children: [] }] }]),
      "macros",
    ],
    ["a workbook with OBPROJ", xlsFile({ obProj: true }), "macros"],
    ["a workbook with an Excel 4 macro sheet", xlsFile({ extraSheetType: 0x01 }), "macros"],
    ["a workbook with a VBA module sheet", xlsFile({ extraSheetType: 0x06 }), "macros"],
    ["a workbook whose sheet substream is a macro sheet", xlsFile({ sheetBof: 0x0040 }), "macros"],
    ["a presentation with a VBA project", pptFile({ vba: true }), "macros"],
    [
      "an embedded Word file with macros",
      xlsFile({}, [{ name: "MBD0001", children: [{ name: "Macros", children: [] }] }]),
      "macros",
    ],
  ])("refuses %s", async (_name, bytes, reason) => {
    expect((await refusalOf(() => inspectCompoundFile(bytes, EVERY_KIND))).reason).toBe(reason);
  });

  it.each<[string, Buffer]>([
    [
      "a presentation without its Current User stream",
      writeCompoundFile([{ name: "PowerPoint Document", data: presentationStream() }]),
    ],
    [
      "a presentation with an unknown header token",
      writeCompoundFile([
        { name: "PowerPoint Document", data: presentationStream() },
        { name: "Current User", data: Buffer.alloc(40) },
      ]),
    ],
    [
      "a presentation whose record runs past its container",
      pptFile({
        document: pptRecord(0x03e8, pptRecord(0x03e9, Buffer.alloc(4)).subarray(0, 10), true),
      }),
    ],
    [
      "a workbook that does not start with BOF",
      writeCompoundFile([{ name: "Workbook", data: Buffer.alloc(700, 1) }]),
    ],
  ])("refuses %s as damaged", async (_name, bytes) => {
    expect((await refusalOf(() => inspectCompoundFile(bytes, EVERY_KIND))).reason).toBe(
      "file_damaged",
    );
  });

  it("accepts a plain current-user stream and trailing padding in the document stream", () => {
    const padded = Buffer.concat([presentationStream(), Buffer.alloc(5)]);
    const bytes = writeCompoundFile([
      { name: "PowerPoint Document", data: padded },
      { name: "Current User", data: currentUserStream() },
    ]);
    expect(inspectCompoundFile(bytes, EVERY_KIND)).toBe("ppt");
  });
});

describe("walkPptRecords", () => {
  it("visits containers and their children in order", () => {
    const stream = pptRecord(
      0x03e8,
      Buffer.concat([pptRecord(0x03e9, Buffer.alloc(4)), pptRecord(0x03ff, Buffer.alloc(0), true)]),
      true,
    );
    const seen: number[] = [];
    walkPptRecords(stream, (type) => seen.push(type));
    expect(seen).toEqual([0x03e8, 0x03e9, 0x03ff]);
  });
});
