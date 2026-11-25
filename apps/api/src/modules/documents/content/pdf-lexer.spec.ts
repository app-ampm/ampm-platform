import { describe, expect, it } from "vitest";

import { tokensOf as tokens } from "./testing/pdf-tokens.js";
import { refusalOf } from "./testing/refusals.js";

/**
 * The bound of the linear-time cases. On 100,000 digits a backtracking number pattern (quadratic) takes over
 * three seconds and the lexer about a millisecond, which a loaded `pnpm check` has stretched to 136 ms: the
 * bound leaves room for a busy machine and still sits far below the quadratic cost.
 */
const LINEAR_TIME_BOUND_MS = 750;

describe("PdfLexer", () => {
  it("reads names, numbers, keywords and delimiters, skipping comments", () => {
    expect(
      tokens("<< /Type /Page /Count -3 /Ratio .5 >> % /JavaScript in a comment\n[1 0 R] true"),
    ).toEqual([
      { kind: "open", value: "<<" },
      { kind: "name", value: "Type" },
      { kind: "name", value: "Page" },
      { kind: "name", value: "Count" },
      { kind: "number", value: -3 },
      { kind: "name", value: "Ratio" },
      { kind: "number", value: 0.5 },
      { kind: "close", value: ">>" },
      { kind: "open", value: "[" },
      { kind: "number", value: 1 },
      { kind: "number", value: 0 },
      { kind: "keyword", value: "R" },
      { kind: "close", value: "]" },
      { kind: "keyword", value: "true" },
    ]);
  });

  it.each([
    ["/J#61vaScript", "JavaScript"],
    ["/#4A#53", "JS"],
    ["/Launch#", "Launch#"],
    ["/A#2", "A#2"],
  ])("decodes the #xx escapes of %s", (text, name) => {
    expect(tokens(text)).toEqual([{ kind: "name", value: name }]);
  });

  it("reads literal strings with nesting and escapes, and does not mistake names inside them", () => {
    const [string] = tokens("(a (b) \\(c\\) \\101\\n\\\r\nd /JS)");
    expect(string?.kind).toBe("string");
    expect(string?.kind === "string" ? string.value.toString("latin1") : "").toBe(
      "a (b) (c) A\nd /JS",
    );
  });

  it("reads hexadecimal strings, padding an odd digit", () => {
    const [string] = tokens("<48 65 6C6C 6F7>");
    expect(string?.kind === "string" ? string.value.toString("hex") : "").toBe("48656c6c6f70");
  });

  it.each(["(never closed", "<414243"])("refuses a string that never ends: %s", async (text) => {
    expect((await refusalOf(() => tokens(text))).reason).toBe("pdf_unreadable");
  });

  it("keeps only the first 1 KiB of a long string", () => {
    const [string] = tokens(`(${"x".repeat(5000)})`);
    expect(string?.kind === "string" ? string.value.length : 0).toBe(1024);
  });

  it.each([
    ["12", 12],
    ["-3.5", -3.5],
    ["+.5", 0.5],
    ["4.", 4],
    ["007", 7],
  ])("reads %s as a number", (text, value) => {
    expect(tokens(text)).toEqual([{ kind: "number", value }]);
  });

  it.each(["1.2.3", "1e5", "--1", "+", ".", "12x"])("reads %s as a keyword", (text) => {
    expect(tokens(text)).toEqual([{ kind: "keyword", value: text }]);
  });

  it.each([
    ["100,000 digits and then a letter", `${"1".repeat(100_000)}x`],
    ["100,000 digits, a point and a letter", `${"1".repeat(100_000)}.x`],
    ["a sign, a point, 100,000 digits and a point", `-.${"1".repeat(100_000)}.`],
  ])("reads %s as one keyword in under 750 ms (linear time; seconds before)", (_name, text) => {
    const bytes = Buffer.from(text, "latin1");
    const started = performance.now();
    const read = tokens(bytes);
    expect(performance.now() - started).toBeLessThan(LINEAR_TIME_BOUND_MS);
    expect(read.map((token) => token.kind)).toEqual(["keyword"]);
  });
});
