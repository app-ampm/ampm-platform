import { describe, expect, it, vi } from "vitest";

import { writeZip } from "./testing/zip-writer.js";
import { endRecordCandidates, hasUsableEndRecord, isUsableEndRecord } from "./zip-end.js";

describe("the ZIP end record search", () => {
  it("finds the record at the end and reports its comment", () => {
    const zip = writeZip([{ name: "a.txt", data: "a" }], { comment: Buffer.from("note") });
    const [record] = endRecordCandidates(zip);
    expect(record?.commentLength).toBe(4);
    expect(record?.entries).toBe(1);
    expect(hasUsableEndRecord(zip)).toBe(true);
  });

  it("finds nothing in a file shorter than a record, or with no signature", () => {
    expect(hasUsableEndRecord(Buffer.from("PK\x05\x06"))).toBe(false);
    expect(hasUsableEndRecord(Buffer.alloc(100))).toBe(false);
  });

  it("ignores a record whose comment would run past the end", () => {
    const zip = writeZip([{ name: "a.txt", data: "a" }], { end: { commentLength: 50 } });
    expect(endRecordCandidates(zip)).toEqual([]);
  });

  it("does not count an empty archive or one on several disks as usable", () => {
    const empty = writeZip([{ name: "a.txt", data: "a", hidden: true }]);
    const [record] = endRecordCandidates(empty);
    expect(record && isUsableEndRecord(empty, record)).toBe(false);
    const split = writeZip([{ name: "a.txt", data: "a" }], { end: { diskNumber: 2 } });
    const [splitRecord] = endRecordCandidates(split);
    expect(splitRecord && isUsableEndRecord(split, splitRecord)).toBe(false);
  });

  it("reads only the last 64 KiB however large the file", () => {
    const zip = writeZip([{ name: "a.txt", data: "a" }]);
    const far = Buffer.concat([zip, Buffer.alloc(70 * 1024)]);
    expect(endRecordCandidates(far)).toEqual([]);
  });

  it("never searches past that window, even in a 25 MiB file with no record", () => {
    const search = vi.spyOn(Buffer.prototype, "lastIndexOf");
    try {
      expect(endRecordCandidates(Buffer.alloc(25 * 1024 * 1024, 0x41))).toEqual([]);
      const searched = search.mock.contexts.map((buffer) => (buffer as Buffer).length);
      expect(searched.length).toBeGreaterThan(0);
      expect(Math.max(...searched)).toBeLessThanOrEqual(22 + 0xffff);
    } finally {
      search.mockRestore();
    }
  });

  it("still finds a record whose comment fills the whole window", () => {
    const zip = writeZip([{ name: "a.txt", data: "a" }], { comment: Buffer.alloc(0xffff, 0x41) });
    const padded = Buffer.concat([Buffer.alloc(1024 * 1024), zip]);
    expect(endRecordCandidates(padded).map((record) => record.commentLength)).toEqual([0xffff]);
  });
});
