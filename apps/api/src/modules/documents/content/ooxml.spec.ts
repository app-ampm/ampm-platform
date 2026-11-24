import { describe, expect, it } from "vitest";

import type { ContentKind } from "./kinds.js";
import { inspectOoxml } from "./ooxml.js";
import { buildPackage, type MainKind, TRANSITIONAL_RELS } from "./testing/ooxml-builder.js";
import { EVERY_KIND, refusalOf } from "./testing/refusals.js";
import { writeZip } from "./testing/zip-writer.js";

const PDF_AND_SLIDES = new Set<ContentKind>(["pdf", "pptx", "ppsx", "potx", "ppt"]);
const FLOOR_PLAN = new Set<ContentKind>(["pdf", "jpeg", "png"]);
const PHOTOS = new Set<ContentKind>(["jpeg", "png", "webp", "gif", "mp4"]);

describe("inspectOoxml: the main part decides the kind (D-187 §2)", () => {
  it.each<[MainKind, ContentKind]>([
    ["pptx", "pptx"],
    ["ppsx", "ppsx"],
    ["potx", "potx"],
    ["xlsx", "xlsx"],
    ["xltx", "xltx"],
  ])("accepts a %s", async (kind, expected) => {
    await expect(inspectOoxml(buildPackage({ kind }), EVERY_KIND)).resolves.toBe(expected);
  });

  it.each<MainKind>(["pptx", "xlsx"])("accepts a Strict OOXML %s", async (kind) => {
    await expect(inspectOoxml(buildPackage({ kind, strict: true }), EVERY_KIND)).resolves.toBe(
      kind,
    );
  });

  it.each<[MainKind, ReadonlySet<ContentKind>, string]>([
    ["docx", EVERY_KIND, "word_document"],
    ["docm", EVERY_KIND, "word_document"],
    ["docx", PHOTOS, "type_not_accepted"],
    ["pptm", EVERY_KIND, "macros"],
    ["xlsm", EVERY_KIND, "macros"],
    ["xlsb", EVERY_KIND, "macros"],
    ["ppsm", EVERY_KIND, "macros"],
    ["potm", EVERY_KIND, "macros"],
    ["ppam", EVERY_KIND, "macros"],
    ["xltm", EVERY_KIND, "macros"],
    ["xlam", EVERY_KIND, "macros"],
    ["xlsm", PDF_AND_SLIDES, "type_not_accepted"],
    ["xlsx", PDF_AND_SLIDES, "type_not_accepted"],
    ["pptx", FLOOR_PLAN, "type_not_accepted"],
    ["xps", EVERY_KIND, "unknown_type"],
  ])("refuses a %s with %s accepted", async (kind, accepted, reason) => {
    const refusal = await refusalOf(inspectOoxml(buildPackage({ kind }), accepted));
    expect(refusal.reason).toBe(reason);
  });

  it("refuses a ZIP that is not an Office package as an unknown type", async () => {
    const zip = writeZip([{ name: "menu.txt", data: "Banquet Hall A" }]);
    expect((await refusalOf(inspectOoxml(zip, EVERY_KIND))).reason).toBe("unknown_type");
  });

  it("refuses two main parts", async () => {
    const pkg = buildPackage({
      relationships: [
        { source: "", type: `${TRANSITIONAL_RELS}/officeDocument`, target: "ppt/presentation.xml" },
      ],
    });
    expect((await refusalOf(inspectOoxml(pkg, EVERY_KIND))).reason).toBe("archive_unsafe");
  });

  it("refuses a type the upload does not take before inflating the parts", async () => {
    const bomb = Buffer.alloc(64 * 1024 * 1024);
    const pkg = buildPackage({ kind: "xlsx", parts: [{ name: "xl/bomb.xml", data: bomb }] });
    expect((await refusalOf(inspectOoxml(pkg, PDF_AND_SLIDES))).reason).toBe("type_not_accepted");
  });

  it("refuses a package that expands too much, measured while inflating", async () => {
    const pkg = buildPackage({
      parts: [{ name: "ppt/bomb.xml", data: Buffer.alloc(64 * 1024 * 1024, 0x20) }],
    });
    expect((await refusalOf(inspectOoxml(pkg, EVERY_KIND))).reason).toBe("archive_expansion");
  });

  it("refuses an XML part with a DTD, and one in UTF-16", async () => {
    const dtd = buildPackage({ body: '<!DOCTYPE x [<!ENTITY a "ppaction://macro">]><p:sld/>' });
    expect((await refusalOf(inspectOoxml(dtd, EVERY_KIND))).reason).toBe("file_damaged");
    const wide = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("<p:sld/>", "utf16le")]);
    const utf16 = buildPackage({ body: wide });
    expect((await refusalOf(inspectOoxml(utf16, EVERY_KIND))).reason).toBe("file_damaged");
  });
});
