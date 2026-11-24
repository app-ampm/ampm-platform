import { readdirSync, readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { loggableDetail } from "../../../common/upload-refusal.js";
import { inspectContent } from "./inspect-content.js";
import { ContentRefusal, fromFile, need, refuse } from "./refusal.js";
import { buildPackage } from "./testing/ooxml-builder.js";
import { EVERY_KIND } from "./testing/refusals.js";

describe("refusal helpers", () => {
  it("refuse throws a ContentRefusal with its reason and detail", () => {
    expect(() => refuse("macros", "a VBA project")).toThrow(ContentRefusal);
    try {
      refuse("macros", "a VBA project");
    } catch (error) {
      expect(error).toMatchObject({ reason: "macros", detail: "a VBA project" });
    }
  });

  it.each([
    [0, 4, true],
    [6, 4, true],
    [7, 4, false],
    [-1, 2, false],
    [2, Number.NaN, false],
  ])("need(offset %i, length %i) inside 10 bytes is %s", (offset, length, inside) => {
    const check = (): void => need(Buffer.alloc(10), offset, length, "a field");
    if (inside) expect(check).not.toThrow();
    else expect(check).toThrow(ContentRefusal);
  });
});

describe("fromFile: a value the file chose is always masked in the logs", () => {
  it.each([
    "ppt/media/Priya Mehta passport.bin",
    'a "quoted" name',
    "a back\\slash and a\nnew line",
    "C:\\Users\\Asha Rao\\menu.xlsx",
    12_345,
  ])("masks %j wherever a detail puts it", (value) => {
    expect(loggableDetail(`a part ${fromFile(value)} in a rule`)).toBe('a part "…" in a rule');
  });
});

/*
 * Every refusal's detail is logged (loggableDetail masks what is quoted), so a value read from the file
 * must reach a detail through fromFile. This reads the module's own source and fails on any other
 * interpolation, except the few listed here: values the checks decided or measured, never the file.
 */

/** The argument of each refusing call that becomes the detail. */
const DETAIL_ARGUMENT: Readonly<Record<string, number>> = { refuse: 1, need: 3, damaged: 0 };

/** Interpolations a detail may carry unmasked, by file, and why. */
const UNMASKED: Readonly<Record<string, readonly string[]>> = {
  // `what` is the detail its callers hand to damaged(), and those calls are checked here too.
  "cfb.ts": ["what"],
  // The kind the main stream decided: "ppt" or "xls".
  "cfb-office.ts": ["kind"],
  // A kind or a family the bytes decided, and the upload's size.
  "inspect-content.ts": ["kind", "family", "bytes.length"],
  // How many main part relationships the check counted, and the kinds the main part decided.
  "ooxml.ts": ["found.count", "main.macroOf", "main.kind"],
  // A key of the refused relationships the type matched, and the refused path or content type it matched.
  "ooxml-rules.ts": ["short", "hit[0]", "pattern"],
  "ooxml-scan.ts": ["MAX_FORMULA_BYTES"],
  // refuseName refuses only a name in REFUSED_NAMES.
  "pdf-check.ts": ["token.value"],
  // A byte offset the search measured.
  "pdf-headers.ts": ["at"],
  "polyglot.ts": ["family"],
  // `what` is the detail its callers hand to need(), and those calls are checked here too.
  "refusal.ts": ["what"],
  // The cap the scanner applies: one of its constants.
  "xml-scan.ts": ["limit"],
  // The package cap, the output the check measured, the kept-part cap, and zlib's own error message.
  "zip-inflate.ts": ["this.limit", "produced", "MAX_KEPT_PART_BYTES", "message"],
  "zip.ts": ["MAX_ZIP_ENTRIES"],
};

function isMasked(expression: ts.Expression, file: ts.SourceFile, allowed: Set<string>): boolean {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return true;
  if (ts.isParenthesizedExpression(expression))
    return isMasked(expression.expression, file, allowed);
  if (ts.isConditionalExpression(expression)) {
    return (
      isMasked(expression.whenTrue, file, allowed) && isMasked(expression.whenFalse, file, allowed)
    );
  }
  if (ts.isTemplateExpression(expression)) {
    return expression.templateSpans.every((span) => isMasked(span.expression, file, allowed));
  }
  const isFromFile =
    ts.isCallExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === "fromFile";
  return isFromFile || allowed.has(expression.getText(file));
}

/** Every interpolation (or whole detail) of `text` that reaches a refusal unmasked. */
function unmaskedDetails(name: string, text: string): string[] {
  const file = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
  const allowed = new Set(UNMASKED[name] ?? []);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const index = DETAIL_ARGUMENT[node.expression.text];
      const detail = index === undefined ? undefined : node.arguments[index];
      const parts = detail && ts.isTemplateExpression(detail) ? detail.templateSpans : [];
      for (const span of parts) {
        if (!isMasked(span.expression, file, allowed))
          found.push(`${name}: ${span.expression.getText(file)}`);
      }
      if (detail && !ts.isTemplateExpression(detail) && !isMasked(detail, file, allowed)) {
        found.push(`${name}: ${detail.getText(file)}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

describe("every refusal's detail masks what the file chose", () => {
  it("finds an unmasked value, quoted or not, so the scan below can be trusted", () => {
    const sample = [
      "refuse('macros', `a ${entry.name} storage`);",
      "need(bytes, 0, 4, `the data of ${JSON.stringify(name)}`);",
      'refuse("unknown_type", name);',
      "refuse('macros', `a ${fromFile(entry.name)} storage`);",
    ].join("\n");
    expect(unmaskedDetails("sample.ts", sample)).toEqual([
      "sample.ts: entry.name",
      "sample.ts: JSON.stringify(name)",
      "sample.ts: name",
    ]);
  });

  it("passes every value read from the file through fromFile", () => {
    const folder = new URL("./", import.meta.url);
    const sources = readdirSync(folder, { withFileTypes: true })
      .filter(
        (entry) => entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".spec.ts"),
      )
      .map((entry) => entry.name);
    expect(sources.length).toBeGreaterThan(20);
    const unmasked = sources.flatMap((name) =>
      unmaskedDetails(name, readFileSync(new URL(name, folder), "utf8")),
    );
    expect(unmasked).toEqual([]);
  });

  it("masks a name read from the file where the detail does not quote it", async () => {
    const pkg = buildPackage({
      parts: [{ name: "ppt/media/Priya Mehta passport.bin", data: Buffer.alloc(16) }],
    });
    const result = await inspectContent(pkg, EVERY_KIND);
    expect(result).toMatchObject({ ok: false, reason: "archive_unsafe" });
    const logged = loggableDetail(result.ok ? "" : result.detail);
    expect(logged).toBe('a part with no content type: "…"');
    expect(logged).not.toMatch(/Priya|Mehta|passport/);
  });
});
