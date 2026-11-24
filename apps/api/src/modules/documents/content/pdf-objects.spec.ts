import { describe, expect, it } from "vitest";

import { dictOf, entry, nameOf, objectId, PdfBuilder, type PdfValue } from "./pdf-objects.js";
import { tokensOf } from "./testing/pdf-tokens.js";
import { refusalOf } from "./testing/refusals.js";

function build(text: string): { builder: PdfBuilder; last: PdfValue | null } {
  const builder = new PdfBuilder();
  let last: PdfValue | null = null;
  for (const token of tokensOf(text)) last = builder.push(token) ?? last;
  return { builder, last };
}

describe("PdfBuilder", () => {
  it("builds dictionaries, arrays and references", () => {
    const { last } = build("<< /Kids [3 0 R 4 0 R] /Open true /Name (x) /Inner << /N 2 >> >>");
    const dict = dictOf(last ?? undefined);
    expect(dict && entry(dict, "Kids")).toEqual({
      kind: "array",
      items: [
        { kind: "ref", num: 3, gen: 0 },
        { kind: "ref", num: 4, gen: 0 },
      ],
    });
    expect(dict && entry(dict, "Open")).toEqual({ kind: "bool", value: true });
    expect(nameOf(dict ? entry(dict, "Inner") : undefined)).toBeNull();
  });

  it("finds the object number before obj", () => {
    const { builder } = build("endobj 12 0");
    expect(objectId(builder.top)).toEqual({ num: 12, gen: 0 });
  });

  it("ignores a close that does not match the open container", () => {
    const { last } = build("<< /A [1 2 >> ] >>");
    expect(last?.kind).toBe("dict");
  });

  it("refuses objects nested over 256 levels", async () => {
    expect((await refusalOf(() => build("[".repeat(300)))).reason).toBe("pdf_unreadable");
  });

  it("refuses one object of over a million values", async () => {
    expect((await refusalOf(() => build(`[${" 1".repeat(1_000_001)}]`))).reason).toBe(
      "pdf_unreadable",
    );
  });
});
