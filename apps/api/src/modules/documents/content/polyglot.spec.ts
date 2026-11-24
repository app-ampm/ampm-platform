import { describe, expect, it } from "vitest";

import { refusePolyglot } from "./polyglot.js";
import { ContentRefusal } from "./refusal.js";
import type { Family } from "./sniff.js";
import { writeZip } from "./testing/zip-writer.js";

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2000, 0x41)]);
const PDF = Buffer.from("%PDF-1.7\n1 0 obj\n<< >>\nendobj\n%%EOF\n");
const ZIP = writeZip([{ name: "payload.txt", data: "Sample Hotel" }]);

function reasonOf(bytes: Buffer, family: Family): string | null {
  try {
    refusePolyglot(bytes, family);
    return null;
  } catch (error) {
    if (error instanceof ContentRefusal) return error.reason;
    throw error;
  }
}

describe("refusePolyglot (D-187 §2)", () => {
  it("lets plain files through", () => {
    expect(reasonOf(JPEG, "jpeg")).toBeNull();
    expect(reasonOf(PDF, "pdf")).toBeNull();
    expect(reasonOf(ZIP, "zip")).toBeNull();
  });

  it.each<[string, Buffer, Family]>([
    ["a JPEG with a ZIP appended", Buffer.concat([JPEG, ZIP]), "jpeg"],
    ["a PDF with a ZIP appended", Buffer.concat([PDF, ZIP]), "pdf"],
    ["a PDF with a ZIP and trailing bytes", Buffer.concat([PDF, ZIP, Buffer.from("tail")]), "pdf"],
    [
      "a JPEG with a prefixed ZIP (offsets from the ZIP's start)",
      Buffer.concat([JPEG, writeZip([{ name: "x.txt", data: "x" }], { relativeOffsets: true })]),
      "jpeg",
    ],
  ])(
    "refuses %s: a non-ZIP file with a ZIP end record in its last 64 KiB",
    (_name, bytes, family) => {
      expect(reasonOf(bytes, family)).toBe("polyglot");
    },
  );

  it("ignores a ZIP end record further back than 64 KiB", () => {
    const far = Buffer.concat([JPEG, ZIP, Buffer.alloc(70 * 1024)]);
    expect(reasonOf(far, "jpeg")).toBeNull();
  });

  it("ignores a bare end signature with no central directory behind it", () => {
    const fake = Buffer.alloc(22);
    fake.writeUInt32LE(0x06054b50, 0);
    fake.writeUInt16LE(1, 8);
    fake.writeUInt16LE(1, 10);
    expect(reasonOf(Buffer.concat([JPEG, fake]), "jpeg")).toBeNull();
  });

  it.each<[string, Buffer, Family]>([
    ["a JPEG", Buffer.concat([JPEG.subarray(0, 600), Buffer.from("%PDF-1.4"), JPEG]), "jpeg"],
    [
      "a ZIP",
      Buffer.concat([Buffer.from("PK\x03\x04"), Buffer.alloc(900), Buffer.from("%PDF-")]),
      "zip",
    ],
    ["a compound file", Buffer.concat([Buffer.alloc(1018), Buffer.from("%PDF-1.7")]), "cfb"],
  ])("refuses %s with %%PDF- in its first 1,024 bytes", (_name, bytes, family) => {
    expect(reasonOf(bytes, family)).toBe("polyglot");
  });

  it("allows %PDF- that starts after the first 1,024 bytes", () => {
    const later = Buffer.concat([JPEG.subarray(0, 4), Buffer.alloc(1020), Buffer.from("%PDF-1.4")]);
    expect(reasonOf(later, "jpeg")).toBeNull();
  });
});
