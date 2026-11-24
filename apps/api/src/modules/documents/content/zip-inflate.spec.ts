import { randomBytes } from "node:crypto";
import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { ContentRefusal } from "./refusal.js";
import { writeZip } from "./testing/zip-writer.js";
import { readZip } from "./zip.js";
import {
  ExpansionBudget,
  inflateEntry,
  MAX_KEPT_PART_BYTES,
  readEntry,
  RATIO_FREE_BYTES,
} from "./zip-inflate.js";

async function refusalOf(work: Promise<unknown>): Promise<ContentRefusal> {
  try {
    await work;
  } catch (error) {
    if (error instanceof ContentRefusal) return error;
    throw error;
  }
  throw new Error("expected a refusal");
}

function only(zip: Buffer) {
  const [entry] = readZip(zip);
  if (!entry) throw new Error("no entry");
  return entry;
}

describe("inflateEntry: expansion measured while inflating (D-187 §2)", () => {
  it("inflates a deflated entry and a stored one, checking size and CRC", async () => {
    const text = "<p:sld>Banquet Hall A</p:sld>".repeat(50);
    for (const method of [0, 8]) {
      const zip = writeZip([{ name: "a.xml", data: text, method }]);
      const chunks: Buffer[] = [];
      await inflateEntry(zip, only(zip), new ExpansionBudget(), (chunk) => chunks.push(chunk));
      expect(Buffer.concat(chunks).toString()).toBe(text);
    }
  });

  it("refuses an entry that expands over 200:1 past the first MiB", async () => {
    const zeros = Buffer.alloc(RATIO_FREE_BYTES * 4);
    const zip = writeZip([{ name: "bomb.xml", data: zeros }]);
    const refusal = await refusalOf(inflateEntry(zip, only(zip), new ExpansionBudget()));
    expect(refusal.reason).toBe("archive_expansion");
  });

  it("lets a small, highly compressible part through (printer settings)", async () => {
    const zip = writeZip([{ name: "printerSettings1.bin", data: Buffer.alloc(4096) }]);
    await expect(inflateEntry(zip, only(zip), new ExpansionBudget())).resolves.toBeUndefined();
  });

  it("refuses a package whose entries together pass the budget", async () => {
    const text = Buffer.from("Sample Hotel ".repeat(1000));
    const zip = writeZip([
      { name: "a.xml", data: text },
      { name: "b.xml", data: text },
    ]);
    const budget = new ExpansionBudget(text.length + 10);
    const [first, second] = readZip(zip);
    await inflateEntry(zip, first!, budget);
    const refusal = await refusalOf(inflateEntry(zip, second!, budget));
    expect(refusal.reason).toBe("archive_expansion");
  });

  it("does not trust the declared size: a lie about it is refused after inflating", async () => {
    const zeros = Buffer.alloc(RATIO_FREE_BYTES * 3);
    const zip = writeZip([
      { name: "bomb.xml", data: zeros, uncompressedSize: 10, localUncompressedSize: 10 },
    ]);
    const refusal = await refusalOf(inflateEntry(zip, only(zip), new ExpansionBudget()));
    expect(refusal.reason).toBe("archive_expansion");
  });

  it.each([
    [
      "a size that differs from the declared one",
      { uncompressedSize: 5, localUncompressedSize: 5 },
    ],
    ["a CRC mismatch", { crc: 12345, localCrc: 12345 }],
  ])("refuses %s as damaged", async (_name, lie) => {
    const zip = writeZip([{ name: "a.xml", data: "<a>Sample Hotel</a>", ...lie }]);
    const refusal = await refusalOf(inflateEntry(zip, only(zip), new ExpansionBudget()));
    expect(refusal.reason).toBe("file_damaged");
  });

  it("refuses a deflate stream that does not inflate", async () => {
    const zip = writeZip([{ name: "a.xml", data: "x", rawCompressed: Buffer.from([0xff, 0xff]) }]);
    const refusal = await refusalOf(inflateEntry(zip, only(zip), new ExpansionBudget()));
    expect(refusal.reason).toBe("file_damaged");
  });

  it("refuses a truncated deflate stream", async () => {
    const whole = deflateRawSync(Buffer.from("Banquet Hall A ".repeat(400)));
    const zip = writeZip([
      { name: "a.xml", data: "Banquet Hall A ".repeat(400), rawCompressed: whole.subarray(0, 20) },
    ]);
    const refusal = await refusalOf(inflateEntry(zip, only(zip), new ExpansionBudget()));
    expect(refusal.reason).toBe("file_damaged");
  });
});

describe("readEntry: the parts kept in memory are capped at 2 MiB", () => {
  it("returns the part", async () => {
    const zip = writeZip([{ name: "_rels/.rels", data: "<Relationships/>" }]);
    const part = await readEntry(zip, only(zip), new ExpansionBudget(), "archive_unsafe");
    expect(part.toString()).toBe("<Relationships/>");
  });

  it("refuses a part over the cap with the caller's reason", async () => {
    const big = Buffer.alloc(MAX_KEPT_PART_BYTES + 1, 0x20);
    const zip = writeZip([{ name: "_rels/.rels", data: big }]);
    const refusal = await refusalOf(
      readEntry(zip, only(zip), new ExpansionBudget(), "active_content"),
    );
    expect(refusal.reason).toBe("active_content");
  });

  it("refuses a part that lies about its size and grows past the cap", async () => {
    const big = randomBytes(MAX_KEPT_PART_BYTES + 100);
    const zip = writeZip([
      { name: "_rels/.rels", data: big, uncompressedSize: 10, localUncompressedSize: 10 },
    ]);
    const refusal = await refusalOf(
      readEntry(zip, only(zip), new ExpansionBudget(), "archive_unsafe"),
    );
    expect(refusal.reason).toBe("archive_unsafe");
  });
});
