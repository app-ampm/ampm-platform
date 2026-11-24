import { describe, expect, it } from "vitest";

import { ContentRefusal } from "./refusal.js";
import { writeZip, type ZipWriterEntry } from "./testing/zip-writer.js";
import { readZip } from "./zip.js";

const PARTS: ZipWriterEntry[] = [
  { name: "[Content_Types].xml", data: "<Types/>" },
  { name: "_rels/.rels", data: "<Relationships/>" },
  { name: "ppt/slides/slide1.xml", data: "<p:sld>Sample Hotel</p:sld>", method: 0 },
];

function refusal(make: () => unknown): { reason: string; detail: string } {
  try {
    make();
  } catch (error) {
    if (error instanceof ContentRefusal) return { reason: error.reason, detail: error.detail };
    throw error;
  }
  throw new Error("expected a refusal");
}

describe("readZip: a well-formed archive", () => {
  it("lists the entries with their data ranges", () => {
    const entries = readZip(writeZip(PARTS));
    expect(entries.map((entry) => entry.name)).toEqual(PARTS.map((part) => part.name));
    expect(entries[2]).toMatchObject({ method: 0, uncompressedSize: 27, compressedSize: 27 });
    expect(entries[0]?.localOffset).toBe(0);
  });

  it("reads data descriptors, signed or not, and folder entries", () => {
    const entries = readZip(
      writeZip([
        { name: "ppt/", data: "", method: 0 },
        { name: "ppt/a.xml", data: "<a/>", dataDescriptor: true },
      ]),
    );
    expect(entries.map((entry) => [entry.name, entry.isFolder])).toEqual([
      ["ppt/", true],
      ["ppt/a.xml", false],
    ]);
  });

  it("accepts a comment that ends the file", () => {
    expect(readZip(writeZip(PARTS, { comment: Buffer.from("Sample Hotel") }))).toHaveLength(3);
  });
});

describe("readZip: archive tricks (D-187 §2)", () => {
  it.each<[string, () => Buffer, string]>([
    [
      "ZIP64 sizes",
      () => writeZip([{ ...PARTS[0]!, compressedSize: 0xffffffff }]),
      "archive_unsafe",
    ],
    [
      "a ZIP64 extra field",
      () => writeZip([{ ...PARTS[0]!, extra: Buffer.from([1, 0, 0, 0]) }]),
      "archive_unsafe",
    ],
    [
      "a ZIP64 end record count",
      () => writeZip(PARTS, { end: { entries: 0xffff } }),
      "archive_unsafe",
    ],
    ["several disks", () => writeZip(PARTS, { end: { diskNumber: 1 } }), "archive_unsafe"],
    [
      "an entry on another disk",
      () => writeZip([{ ...PARTS[0]!, diskStart: 1 }]),
      "archive_unsafe",
    ],
    [
      "more than 5,000 entries",
      () =>
        writeZip(
          Array.from({ length: 5001 }, (_, index) => ({
            name: `p/${index}.xml`,
            data: "",
            method: 0,
          })),
        ),
      "archive_unsafe",
    ],
    ["an encrypted entry", () => writeZip([{ ...PARTS[0]!, flags: 1 }]), "password_protected"],
    ["a WinZip AES entry", () => writeZip([{ ...PARTS[0]!, method: 99 }]), "password_protected"],
    ["bzip2 (method 12)", () => writeZip([{ ...PARTS[0]!, method: 12 }]), "archive_unsafe"],
    [
      "a local name that differs",
      () => writeZip([{ ...PARTS[0]!, localName: "x.xml" }]),
      "archive_unsafe",
    ],
    ["a local CRC that differs", () => writeZip([{ ...PARTS[0]!, localCrc: 7 }]), "archive_unsafe"],
    [
      "a local method that differs",
      () => writeZip([{ ...PARTS[2]!, localMethod: 8 }]),
      "archive_unsafe",
    ],
    [
      "a local size that differs",
      () => writeZip([{ ...PARTS[0]!, localUncompressedSize: 1 }]),
      "archive_unsafe",
    ],
    [
      "a data descriptor that differs",
      () => writeZip([{ ...PARTS[0]!, dataDescriptor: true, uncompressedSize: 99 }]),
      "archive_unsafe",
    ],
    [
      "two names Office reads as one (case)",
      () => writeZip([PARTS[0]!, { name: "[content_types].XML", data: "x" }]),
      "archive_unsafe",
    ],
    [
      "two names Office reads as one (percent-encoding)",
      () =>
        writeZip([
          { name: "a b.xml", data: "x" },
          { name: "a%20b.xml", data: "y" },
        ]),
      "archive_unsafe",
    ],
    [
      "two names Office reads as one (Unicode composition)",
      () =>
        writeZip([
          { name: "caf\u00e9.xml", data: "x" },
          { name: "cafe\u0301.xml", data: "y" },
        ]),
      "archive_unsafe",
    ],
    ["a .. segment", () => writeZip([{ name: "ppt/../../evil.xml", data: "x" }]), "archive_unsafe"],
    [
      "an encoded .. segment",
      () => writeZip([{ name: "ppt/%2e%2e/x.xml", data: "x" }]),
      "archive_unsafe",
    ],
    ["an absolute name", () => writeZip([{ name: "/etc/passwd", data: "x" }]), "archive_unsafe"],
    ["a backslash", () => writeZip([{ name: "ppt\\slide.xml", data: "x" }]), "archive_unsafe"],
    ["a drive letter", () => writeZip([{ name: "C:/x.xml", data: "x" }]), "archive_unsafe"],
    [
      "a folder with data",
      () => writeZip([{ name: "ppt/", data: "x", method: 0 }]),
      "archive_unsafe",
    ],
    [
      "bytes after the end record",
      () => writeZip(PARTS, { suffix: Buffer.from("trailing") }),
      "polyglot",
    ],
    [
      "bytes before the first local header",
      () => writeZip([{ name: "hidden.bin", data: "payload", hidden: true }, ...PARTS]),
      "polyglot",
    ],
    [
      "two entries sharing one local header",
      () => writeZip([PARTS[0]!, { ...PARTS[1]!, centralOffsetOf: 0 }]),
      "archive_unsafe",
    ],
    [
      "bytes between the directory and the end record",
      () => writeZip(PARTS, { betweenCentralAndEnd: Buffer.from("gap") }),
      "archive_unsafe",
    ],
    [
      "a ZIP64 end locator",
      () => writeZip(PARTS, { betweenCentralAndEnd: zip64Locator() }),
      "archive_unsafe",
    ],
    [
      "two end records that both end the file",
      () => writeZip(PARTS, { comment: endRecordComment() }),
      "archive_unsafe",
    ],
    ["no end record", () => writeZip(PARTS).subarray(0, -22), "file_damaged"],
    ["an empty archive", () => emptyArchive(), "file_damaged"],
  ])("refuses %s", (_name, make, reason) => {
    expect(refusal(() => readZip(make())).reason).toBe(reason);
  });

  it("refuses a central directory that points outside the file", () => {
    const zip = writeZip(PARTS, { end: { centralOffset: 10_000_000, centralSize: 0 } });
    expect(refusal(() => readZip(zip)).reason).toMatch(/archive_unsafe|file_damaged/);
  });

  it("refuses an entry whose local header sits inside another entry's data (overlap)", () => {
    const inner = writeZip([{ name: "b.xml", data: "<b/>", method: 0 }]);
    const innerLocal = inner.subarray(0, 30 + "b.xml".length + 4);
    const zip = writeZip([
      { name: "a.bin", data: innerLocal, method: 0 },
      { name: "b.xml", data: "<b/>", method: 0 },
    ]);
    const secondCentral = zip.indexOf(
      Buffer.from([0x50, 0x4b, 0x01, 0x02]),
      zip.indexOf("PK\x01\x02") + 4,
    );
    zip.writeUInt32LE(30 + "a.bin".length, secondCentral + 42);
    expect(refusal(() => readZip(zip))).toMatchObject({ reason: "archive_unsafe" });
    expect(refusal(() => readZip(zip)).detail).toMatch(/overlapping/);
  });
});

/** A ZIP64 end-of-central-directory locator: its signature and 16 bytes. */
function zip64Locator(): Buffer {
  const locator = Buffer.alloc(20);
  locator.writeUInt32LE(0x07064b50, 0);
  return locator;
}

/** A comment holding a second, empty end record, so two records end the file. */
function endRecordComment(): Buffer {
  const record = Buffer.alloc(22);
  record.writeUInt32LE(0x06054b50, 0);
  return record;
}

function emptyArchive(): Buffer {
  const local = writeZip([{ name: "a", data: "", method: 0, hidden: true }]);
  return local;
}
