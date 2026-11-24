import { describe, expect, it } from "vitest";

import { readCompoundFile } from "./cfb.js";
import { type CfbLayout, writeCompoundFile } from "./testing/cfb-writer.js";
import { refusalOf } from "./testing/refusals.js";

const BIG = Buffer.alloc(10_000, 0x41);
const SMALL = Buffer.from("Sample Hotel");

describe("readCompoundFile: structure under bounds ([MS-CFB])", () => {
  it("reads storages and streams, small streams from the mini stream", () => {
    const file = readCompoundFile(
      writeCompoundFile([
        { name: "Workbook", data: BIG },
        { name: "Notes", data: SMALL },
        { name: "_SX_DB_CUR", children: [{ name: "0001", data: SMALL }] },
      ]),
    );
    const byName = new Map(file.entries.map((entry) => [entry.name, entry]));
    expect([...byName.keys()].sort()).toEqual(["0001", "Notes", "Workbook", "_SX_DB_CUR"]);
    expect(byName.get("0001")?.depth).toBe(2);
    expect(file.read(byName.get("Workbook")!).equals(BIG)).toBe(true);
    expect(file.read(byName.get("Notes")!).equals(SMALL)).toBe(true);
  });

  it.each<[string, (bytes: Buffer, layout: CfbLayout) => void]>([
    ["a wrong byte order", (bytes) => bytes.writeUInt16LE(0xfeff, 28)],
    ["an unknown sector size", (bytes) => bytes.writeUInt16LE(10, 30)],
    ["more FAT sectors than the file holds", (bytes) => bytes.writeUInt32LE(100_000, 44)],
    ["a FAT sector outside the file", (bytes) => bytes.writeUInt32LE(90_000, 76)],
    [
      "a directory chain that loops",
      (bytes, layout) => {
        const first = layout.firstSector("directory");
        bytes.writeUInt32LE(first, layout.fatEntryOffset(first));
      },
    ],
    [
      "a directory tree that loops",
      (bytes, layout) => {
        const id = layout.idOf("Notes");
        bytes.writeUInt32LE(id, layout.entryOffset(id) + 72);
      },
    ],
    [
      "a storage that holds its parent",
      (bytes, layout) => {
        bytes.writeUInt32LE(0, layout.entryOffset(layout.idOf("Notes")) + 76);
        bytes.writeUInt8(1, layout.entryOffset(layout.idOf("Notes")) + 66);
      },
    ],
    [
      "a root that is not a root",
      (bytes, layout) => bytes.writeUInt8(1, layout.entryOffset(0) + 66),
    ],
    [
      "a stream larger than the file",
      (bytes, layout) =>
        bytes.writeUInt32LE(50_000_000, layout.entryOffset(layout.idOf("Workbook")) + 120),
    ],
    [
      "an entry name longer than 32 characters",
      (bytes, layout) => bytes.writeUInt16LE(80, layout.entryOffset(layout.idOf("Notes")) + 64),
    ],
  ])("refuses %s as damaged", async (_name, tamper) => {
    const bytes = writeCompoundFile(
      [
        { name: "Workbook", data: BIG },
        { name: "Notes", data: SMALL },
      ],
      tamper,
    );
    const refusal = await refusalOf(() => {
      const file = readCompoundFile(bytes);
      for (const entry of file.entries) if (entry.type === "stream") file.read(entry);
    });
    expect(refusal.reason).toBe("file_damaged");
  });

  it("refuses a stream chain that loops, when the stream is read", async () => {
    const bytes = writeCompoundFile([{ name: "Workbook", data: BIG }], (raw, layout) => {
      const first = layout.firstSector("Workbook");
      raw.writeUInt32LE(first, layout.fatEntryOffset(first + 1));
    });
    const file = readCompoundFile(bytes);
    const refusal = await refusalOf(() => file.read(file.entries[0]!));
    expect(refusal.reason).toBe("file_damaged");
  });

  it("refuses a stream whose chain ends before its size", async () => {
    const bytes = writeCompoundFile([{ name: "Workbook", data: BIG }], (raw, layout) => {
      raw.writeUInt32LE(0xfffffffe, layout.fatEntryOffset(layout.firstSector("Workbook")));
    });
    const file = readCompoundFile(bytes);
    expect((await refusalOf(() => file.read(file.entries[0]!))).reason).toBe("file_damaged");
  });

  it("refuses a file shorter than its header", async () => {
    const bytes = writeCompoundFile([{ name: "Notes", data: SMALL }]).subarray(0, 300);
    expect((await refusalOf(() => readCompoundFile(bytes))).reason).toBe("file_damaged");
  });

  it("refuses a DIFAT chain that loops", async () => {
    // 237 FAT sectors need the header's 109 and two DIFAT sectors of 127; the first points to itself.
    const bytes = writeCompoundFile([{ name: "Workbook", data: Buffer.alloc(130_000, 0x41) }]);
    bytes.writeUInt32LE(237, 44);
    bytes.writeUInt32LE(5, 68);
    bytes.writeUInt32LE(2, 72);
    bytes.writeUInt32LE(5, (5 + 1) * 512 + 508);
    const refusal = await refusalOf(() => readCompoundFile(bytes));
    expect(refusal).toMatchObject({ reason: "file_damaged" });
    expect(refusal.detail).toMatch(/DIFAT/);
  });
});
