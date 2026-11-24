import type { ContentKind } from "@ampm/core";
import { describe, expect, it } from "vitest";

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

  it("reads a long content types tag in linear time, before the type check", async () => {
    const zip = writeZip([
      { name: "[Content_Types].xml", data: `<Types><Default ${"b".repeat(200_000)}/></Types>` },
      {
        name: "_rels/.rels",
        data: `<Relationships><Relationship Id="r1" Type="${TRANSITIONAL_RELS}/officeDocument" Target="ppt/presentation.xml"/></Relationships>`,
      },
      { name: "ppt/presentation.xml", data: "<p/>" },
    ]);
    const started = performance.now();
    const refusal = await refusalOf(inspectOoxml(zip, PHOTOS));
    expect(performance.now() - started).toBeLessThan(1000);
    expect(refusal.reason).toBe("unknown_type");
  });

  it("refuses a package that expands too much, measured while inflating", async () => {
    const pkg = buildPackage({
      parts: [{ name: "ppt/bomb.xml", data: Buffer.alloc(64 * 1024 * 1024, 0x20) }],
    });
    expect((await refusalOf(inspectOoxml(pkg, EVERY_KIND))).reason).toBe("archive_expansion");
  });

  it("refuses an XML part with a DTD, and one in UTF-16 without a byte order mark", async () => {
    const dtd = buildPackage({ body: '<!DOCTYPE x [<!ENTITY a "ppaction://macro">]><p:sld/>' });
    expect((await refusalOf(inspectOoxml(dtd, EVERY_KIND))).reason).toBe("file_damaged");
    const noMark = buildPackage({ body: Buffer.from("<p:sld/>", "utf16le") });
    expect((await refusalOf(inspectOoxml(noMark, EVERY_KIND))).reason).toBe("file_damaged");
  });

  it("reads parts in UTF-16 with a byte order mark, which OPC allows, and checks them", async () => {
    const wide = (text: string): Buffer =>
      Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")]);
    const clean = '<?xml version="1.0" encoding="UTF-16"?><p:sld><a:t>Sample Hotel</a:t></p:sld>';
    await expect(inspectOoxml(buildPackage({ body: wide(clean) }), EVERY_KIND)).resolves.toBe(
      "pptx",
    );
    const action = '<p:sld><a:hlinkClick r:id="" action="ppaction://macro?name=Run"/></p:sld>';
    const refusal = await refusalOf(inspectOoxml(buildPackage({ body: wide(action) }), EVERY_KIND));
    expect(refusal.reason).toBe("active_content");
  });

  it("reads content types and package relationships in UTF-16", async () => {
    const wide = (text: string): Buffer =>
      Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(text, "utf16le").swap16()]);
    const zip = writeZip([
      {
        name: "[Content_Types].xml",
        data: wide(
          '<Types><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/></Types>',
        ),
      },
      {
        name: "_rels/.rels",
        data: wide(
          `<Relationships><Relationship Id="r1" Type="${TRANSITIONAL_RELS}/officeDocument" Target="ppt/presentation.xml"/></Relationships>`,
        ),
      },
      { name: "ppt/presentation.xml", data: "<main/>" },
    ]);
    await expect(inspectOoxml(zip, EVERY_KIND)).resolves.toBe("pptx");
  });
});
