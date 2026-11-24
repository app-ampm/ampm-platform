import { readdirSync, readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { inspectContent } from "./inspect-content.js";
import type { ContentKind } from "./kinds.js";
import { EVERY_KIND } from "./testing/refusals.js";
import { writeZip } from "./testing/zip-writer.js";
import { readZip } from "./zip.js";

/*
 * The committed fixtures (apps/api/test/fixtures/content, made by generate/generate.sh from real tools;
 * README.md names each one's source). Every file there must be listed in expected.json, so a regenerated
 * set cannot add a file nobody checked.
 */

const FOLDER = new URL("../../../../test/fixtures/content/", import.meta.url);
type Expected = { kind: ContentKind } | { reason: string };
const EXPECTED: Record<string, Expected> = JSON.parse(
  readFileSync(new URL("expected.json", FOLDER), "utf8"),
) as Record<string, Expected>;
const fixture = (name: string): Buffer => readFileSync(new URL(name, FOLDER));

describe("the committed fixtures (real exports, D-187 §2)", () => {
  it("lists every fixture file in expected.json, and each one exists", () => {
    const files = readdirSync(FOLDER, { withFileTypes: true })
      .filter((entry) => entry.isFile() && !/\.(md|json)$/.test(entry.name))
      .map((entry) => entry.name)
      .sort();
    expect(files).toEqual(Object.keys(EXPECTED).sort());
  });

  it("keeps every fixture under 200 KB and all of them under 3 MB", () => {
    const sizes = Object.keys(EXPECTED).map((name) => fixture(name).length);
    expect(Math.max(...sizes)).toBeLessThan(200 * 1024);
    expect(sizes.reduce((sum, size) => sum + size, 0)).toBeLessThan(3 * 1024 * 1024);
  });

  it.each(Object.entries(EXPECTED))("%s", async (name, expected) => {
    const result = await inspectContent(fixture(name), EVERY_KIND);
    if ("kind" in expected) expect(result).toEqual({ ok: true, kind: expected.kind });
    else expect(result).toMatchObject({ ok: false, reason: expected.reason });
  });
});

/** A real package with its main part's content type changed, everything else as exported. */
function retype(bytes: Buffer, from: string, to: string): Buffer {
  const entries = readZip(bytes).map((entry) => {
    const stored = bytes.subarray(entry.dataStart, entry.dataEnd);
    const data = entry.method === 0 ? Buffer.from(stored) : inflateRawSync(stored);
    const text =
      entry.name === "[Content_Types].xml" ? data.toString("utf8").replace(from, to) : null;
    return {
      name: entry.name,
      data: text === null ? data : Buffer.from(text, "utf8"),
      method: entry.method,
    };
  });
  return writeZip(entries);
}

describe("the other Office kinds, from the real Keynote and Numbers exports", () => {
  const PML = "application/vnd.openxmlformats-officedocument.presentationml";
  const SML = "application/vnd.openxmlformats-officedocument.spreadsheetml";

  it.each<[string, string, string, string, string]>([
    [
      "a slide show (ppsx)",
      "keynote-14.4.pptx",
      `${PML}.presentation.main+xml`,
      `${PML}.slideshow.main+xml`,
      "ppsx",
    ],
    [
      "a template (potx)",
      "keynote-14.4.pptx",
      `${PML}.presentation.main+xml`,
      `${PML}.template.main+xml`,
      "potx",
    ],
    [
      "a workbook template (xltx)",
      "numbers-14.4.xlsx",
      `${SML}.sheet.main+xml`,
      `${SML}.template.main+xml`,
      "xltx",
    ],
  ])("accepts %s", async (_name, source, from, to, kind) => {
    const bytes = retype(fixture(source), from, to);
    expect(await inspectContent(bytes, EVERY_KIND)).toEqual({ ok: true, kind });
  });

  it("refuses the Keynote deck renamed as macro-enabled (pptm)", async () => {
    const bytes = retype(
      fixture("keynote-14.4.pptx"),
      `${PML}.presentation.main+xml`,
      "application/vnd.ms-powerpoint.presentation.macroEnabled.main+xml",
    );
    expect(await inspectContent(bytes, EVERY_KIND)).toMatchObject({ ok: false, reason: "macros" });
  });
});
