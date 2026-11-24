import { describe, expect, it } from "vitest";

import { isDdeFormula, MAX_FORMULA_BYTES, partScanner } from "./ooxml-scan.js";
import { refusalOf } from "./testing/refusals.js";

function scanPart(xml: string, chunk = Number.MAX_SAFE_INTEGER): void {
  const scanner = partScanner("xl/worksheets/sheet1.xml");
  const bytes = Buffer.from(xml, "utf8");
  for (let at = 0; at < bytes.length; at += chunk) scanner.write(bytes.subarray(at, at + chunk));
  scanner.end();
}

describe("partScanner (D-187 §2: actions and DDE inside a part)", () => {
  it.each([1, 5, 64])("finds a DDE formula fed %i bytes at a time", async (chunk) => {
    const xml = "<sheetData><row><c><f>cmd|'/c calc'!A0</f></c></row></sheetData>";
    expect((await refusalOf(() => scanPart(xml, chunk))).reason).toBe("external_content");
  });

  it.each([1, 3, 64])("finds a program action fed %i bytes at a time", async (chunk) => {
    const xml = '<p:sp><a:hlinkClick r:id="" action="&#112;paction://ole?verb=0"/></p:sp>';
    expect((await refusalOf(() => scanPart(xml, chunk))).reason).toBe("active_content");
  });

  it("reads a formula only inside a formula element, and nested markup does not end it early", () => {
    expect(() => scanPart("<c><v>1|2</v><is><t>Hall A | Hall B</t></is></c>")).not.toThrow();
    expect(() => scanPart('<c><f t="array">SUM(A1:A2)</f><f/><f>"a|b"</f></c>')).not.toThrow();
  });

  it("refuses a formula over its cap", async () => {
    const xml = `<c><f>${"A".repeat(MAX_FORMULA_BYTES + 1)}</f></c>`;
    expect((await refusalOf(() => scanPart(xml))).reason).toBe("file_damaged");
  });
});

describe("isDdeFormula", () => {
  it.each([
    ["cmd|' /C calc'!A0", true],
    ["'cmd'|'/c calc'!A0", true],
    ['"a|b"&"c"', false],
    ["SUM(A1:A3)", false],
    ['"say ""|"""&x|y!z', true],
    ['"""|"""', false],
  ])("isDdeFormula(%s) is %s", (formula, expected) => {
    expect(isDdeFormula(formula)).toBe(expected);
  });
});
