import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import type { PdfDict, PdfValue } from "./pdf-objects.js";
import {
  decodeObjectStream,
  indexIntegerObjects,
  isObjectStream,
  MAX_OBJECT_STREAM_BYTES,
  ObjectStreamBudget,
  streamDataStart,
  streamExtent,
} from "./pdf-streams.js";
import { refusalOf } from "./testing/refusals.js";

const name = (value: string): PdfValue => ({ kind: "name", value });
const number = (value: number): PdfValue => ({ kind: "number", value });
const dict = (entries: Record<string, PdfValue>): PdfDict => ({
  kind: "dict",
  entries: new Map(Object.entries(entries)),
});
const ID = { num: 7, gen: 0 };

describe("stream extents", () => {
  const pdf = Buffer.from(
    "1 0 obj << >> stream\r\nSample Hotel\nendstream endobj 9 0 obj 12 endobj",
  );

  it("starts the data after the end of line, and indexes integer objects", () => {
    expect(streamDataStart(pdf, pdf.indexOf("stream") + 6)).toBe(pdf.indexOf("Sample"));
    expect(indexIntegerObjects(pdf)).toEqual(new Map([[9, 12]]));
  });

  it.each<[string, PdfValue | undefined]>([
    ["a direct /Length", number(12)],
    ["an indirect /Length", { kind: "ref", num: 9, gen: 0 }],
    ["a wrong /Length (found by searching)", number(3)],
    ["no /Length", undefined],
  ])("ends the stream at its data with %s", (_name, length) => {
    const start = pdf.indexOf("Sample");
    const extent = streamExtent(
      pdf,
      dict(length ? { Length: length } : {}),
      start,
      indexIntegerObjects(pdf),
    );
    expect(pdf.subarray(start, extent.end).toString()).toBe("Sample Hotel");
    expect(pdf.subarray(extent.resume).toString().startsWith(" endobj")).toBe(true);
  });

  it("refuses a stream without endstream", async () => {
    const cut = Buffer.from("stream\nSample Hotel");
    expect((await refusalOf(() => streamExtent(cut, dict({}), 7, new Map()))).reason).toBe(
      "pdf_unreadable",
    );
  });
});

describe("object streams", () => {
  it("are known by /Type /ObjStm or by the /N and /First a reader needs", () => {
    expect(isObjectStream(dict({ Type: name("ObjStm") }))).toBe(true);
    expect(isObjectStream(dict({ N: number(1), First: number(4) }))).toBe(true);
    expect(isObjectStream(dict({ N: number(3) }))).toBe(false);
  });

  it("are inflated, and plain ones pass as they are", () => {
    const content = Buffer.from("1 0 << /Type /Page >>");
    const flate = dict({ Filter: name("FlateDecode") });
    expect(
      decodeObjectStream(flate, deflateSync(content), ID, null, new ObjectStreamBudget()),
    ).toEqual(content);
    expect(decodeObjectStream(dict({}), content, ID, null, new ObjectStreamBudget())).toEqual(
      content,
    );
  });

  it.each<[string, PdfDict]>([
    ["another filter", dict({ Filter: name("LZWDecode") })],
    [
      "two filters",
      dict({ Filter: { kind: "array", items: [name("ASCIIHexDecode"), name("FlateDecode")] } }),
    ],
    [
      "a predictor",
      dict({ Filter: name("FlateDecode"), DecodeParms: dict({ Predictor: number(12) }) }),
    ],
  ])("are refused with %s", async (_name, streamDict) => {
    const data = deflateSync(Buffer.from("1 0 << >>"));
    expect(
      (
        await refusalOf(() =>
          decodeObjectStream(streamDict, data, ID, null, new ObjectStreamBudget()),
        )
      ).reason,
    ).toBe("pdf_unreadable");
  });

  it("are refused past 8 MiB", async () => {
    const big = deflateSync(Buffer.alloc(MAX_OBJECT_STREAM_BYTES + 1, 0x20));
    const flate = dict({ Filter: name("FlateDecode") });
    expect(
      (await refusalOf(() => decodeObjectStream(flate, big, ID, null, new ObjectStreamBudget())))
        .reason,
    ).toBe("pdf_unreadable");
  });

  it("share a 64 MiB budget across one file", async () => {
    const budget = new ObjectStreamBudget();
    const chunk = Buffer.alloc(MAX_OBJECT_STREAM_BYTES, 0x20);
    for (let index = 0; index < 8; index += 1) budget.spend(chunk.length);
    expect((await refusalOf(() => budget.spend(1))).reason).toBe("pdf_unreadable");
  });
});
