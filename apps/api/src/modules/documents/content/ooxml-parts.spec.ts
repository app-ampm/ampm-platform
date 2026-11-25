import { describe, expect, it } from "vitest";

import {
  contentTypeOf,
  forEachRelationship,
  parseContentTypes,
  parseTag,
  type Relationship,
  resolveTarget,
  sourceOfRels,
} from "./ooxml-parts.js";
import { refusalOf } from "./testing/refusals.js";

const TYPES = Buffer.from(
  '<?xml version="1.0"?><Types xmlns="x"><Default Extension="XML" ContentType="application/xml"/>' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml; charset=utf-8"/>' +
    '<Override PartName="/PPT/Presentation.xml" ContentType="Application/Vnd.Openxmlformats-Officedocument.Presentationml.Presentation.Main+Xml"/></Types>',
);

describe("parseContentTypes and contentTypeOf (OPC [Content_Types].xml)", () => {
  const types = parseContentTypes(TYPES);

  it("prefers an override, compared without case, and lower-cases types without parameters", () => {
    expect(contentTypeOf(types, "ppt/presentation.xml")).toBe(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
    );
    expect(contentTypeOf(types, "_rels/.rels")).toBe(
      "application/vnd.openxmlformats-package.relationships+xml",
    );
    expect(contentTypeOf(types, "ppt/slides/slide1.xml")).toBe("application/xml");
  });

  it("gives a part with no override and an unknown extension no content type", () => {
    expect(contentTypeOf(types, "ppt/media/image1.emf")).toBeNull();
    expect(contentTypeOf(types, "ppt/noextension")).toBeNull();
  });

  it("reads a percent-encoded extension as Office does, by its normalised name", () => {
    expect(contentTypeOf(types, "ppt/slides/slide1.x%6Dl")).toBe("application/xml");
  });

  it("refuses two defaults for one extension, one of them percent-encoded", async () => {
    const twice = Buffer.from(
      '<Types><Default Extension="xml" ContentType="a"/><Default Extension="x%6Dl" ContentType="b"/></Types>',
    );
    expect((await refusalOf(() => parseContentTypes(twice))).reason).toBe("archive_unsafe");
  });

  it("refuses two content types for one extension or part", async () => {
    const twice = Buffer.from(
      '<Types><Default Extension="xml" ContentType="a"/><Default Extension="XML" ContentType="b"/></Types>',
    );
    expect((await refusalOf(() => parseContentTypes(twice))).reason).toBe("archive_unsafe");
  });
});

describe("relationship parts", () => {
  it.each([
    ["_rels/.rels", ""],
    ["ppt/_rels/presentation.xml.rels", "ppt/presentation.xml"],
    ["ppt/slides/_rels/slide1.xml.rels", "ppt/slides/slide1.xml"],
    ["ppt/slides/slide1.xml", null],
    ["ppt/notes.rels", null],
    ["%5Frels/.rels", ""],
    ["ppt/slides/%5Frels/Slide1.xml.rels", "ppt/slides/slide1.xml"],
  ])("%s describes %j", (name, source) => {
    expect(sourceOfRels(name)).toBe(source);
  });

  it("reads type, target and target mode, entities decoded", () => {
    const xml = Buffer.from(
      '<Relationships><Relationship Id="rId1" Type="t/hyperlink" Target="https://example.com/?a=1&amp;b=2" TargetMode="External"/><Relationship Id="rId2" Type="t/image" Target="../media/a.png"/></Relationships>',
    );
    const read: Relationship[] = [];
    forEachRelationship(xml, "ppt/slides/_rels/slide1.xml.rels", (item) => read.push(item));
    expect(read).toEqual([
      {
        source: "ppt/slides/slide1.xml",
        type: "t/hyperlink",
        target: "https://example.com/?a=1&b=2",
        external: true,
      },
      {
        source: "ppt/slides/slide1.xml",
        type: "t/image",
        target: "../media/a.png",
        external: false,
      },
    ]);
  });

  it.each([
    ["ppt/slides/slide1.xml", "../media/a.png", "ppt/media/a.png"],
    ["ppt/slides/slide1.xml", "/ppt/media/a.png", "ppt/media/a.png"],
    ["", "ppt/presentation.xml", "ppt/presentation.xml"],
    ["ppt/charts/chart1.xml", "../embeddings/Book.xlsx#part", "ppt/embeddings/Book.xlsx"],
    ["ppt/slides/slide1.xml", "../../../etc/passwd", null],
  ])("resolves %j + %j to %j", (source, target, resolved) => {
    expect(resolveTarget(source, target)).toBe(resolved);
  });
});

describe("parseTag", () => {
  it("reads the name, prefix-free local name, attributes and form", () => {
    expect(parseTag("<a:hlinkClick r:id=\"\" action='x&amp;y'/>", "p")).toEqual({
      name: "a:hlinkClick",
      local: "hlinkClick",
      attributes: new Map([
        ["r:id", ""],
        ["action", "x&y"],
      ]),
      selfClosing: true,
    });
  });

  it("refuses a repeated attribute", async () => {
    const tag = '<Relationship TargetMode="Internal" TargetMode="External"/>';
    expect((await refusalOf(() => parseTag(tag, "p"))).reason).toBe("file_damaged");
  });

  it("reads attributes written without a space between them, as before", () => {
    const tag = parseTag('<Relationship Id="rId1"Type=\'t\' Target = "x"/>', "p");
    expect([...tag.attributes]).toEqual([
      ["Id", "rId1"],
      ["Type", "t"],
      ["Target", "x"],
    ]);
  });

  it.each([
    ["one attribute name of 100,000 characters with no value", ` ${"b".repeat(100_000)}`],
    ["quotes and names with no value", ` ${'"b'.repeat(50_000)}`],
    ["a name before 100,000 spaces", ` b${" ".repeat(100_000)}b`],
    ["names and equals signs with no quoted value", ` b=${"b=".repeat(50_000)}`],
  ])("reads %s in under 750 ms (linear time; seconds before)", (_name, attributes) => {
    // About a millisecond on an idle machine; the bound leaves room for a loaded `pnpm check` and still
    // sits far below the seconds a backtracking parse took.
    const tag = `<Default${attributes}/>`;
    const started = performance.now();
    parseTag(tag, "[Content_Types].xml");
    expect(performance.now() - started).toBeLessThan(750);
  });
});
