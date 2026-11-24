import { describe, expect, it } from "vitest";

import { forEachObjectHeader, refuseUnexaminedHeaders } from "./pdf-headers.js";
import { refusalOf } from "./testing/refusals.js";

/** Where `obj` starts in every header a viewer could read in `text`. */
function headers(text: string | Buffer): number[] {
  const found: number[] = [];
  const bytes = typeof text === "string" ? Buffer.from(text, "latin1") : text;
  forEachObjectHeader(bytes, (at) => found.push(at));
  return found;
}

describe("forEachObjectHeader: where a viewer could read `<number> <number> obj` (D-187 §2)", () => {
  it.each<[string, number[]]>([
    ["1 0 obj", [4]],
    ["12 0 obj<<", [5]],
    ["1 0 obj\n2 0 obj", [4, 12]],
    ["(1 0 obj)", [5]],
    ["% 1 0 obj", [6]],
    ["x1 0 obj", [5]],
    ["+1 0 obj", [5]],
    ["1.0 0 obj", [6]],
    ["1 0 %a note\nobj", [12]],
    ["1\r\n0\r\nobj", [6]],
    ["1\u00000 obj", [4]],
  ])("finds %j at %j", (text, expected) => {
    expect(headers(text)).toEqual(expected);
  });

  it.each([
    "1 0 R",
    "1 0obj",
    "1 0 objx",
    "1 obj",
    "1 0 endobj",
    "an obj file",
    "rooms 1 2 objects",
    "0000000015 00000 n",
    "1 0 % obj\n",
  ])("finds none in %j", (text) => {
    expect(headers(text)).toEqual([]);
  });

  it("reads 25 MiB of digits and spaces in under a second (linear time)", () => {
    const bytes = Buffer.alloc(25 * 1024 * 1024, "1 ");
    const started = performance.now();
    expect(headers(bytes)).toEqual([]);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe("refuseUnexaminedHeaders", () => {
  const pdf = Buffer.from("1 0 obj << >> endobj\n% 2 0 obj << >> endobj\n", "latin1");

  it("passes when the check read every header", () => {
    expect(() => refuseUnexaminedHeaders(pdf, [4, 27])).not.toThrow();
  });

  it("refuses a header the check did not read as unreadable", async () => {
    expect((await refusalOf(() => refuseUnexaminedHeaders(pdf, [4]))).reason).toBe(
      "pdf_unreadable",
    );
  });
});
