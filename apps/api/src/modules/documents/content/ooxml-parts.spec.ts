import { describe, expect, it } from "vitest";

import {
  contentTypeOf,
  parseContentTypes,
  parseRelationships,
  parseTag,
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
  ])("%s describes %j", (name, source) => {
    expect(sourceOfRels(name)).toBe(source);
  });

  it("reads type, target and target mode, entities decoded", () => {
    const xml = Buffer.from(
      '<Relationships><Relationship Id="rId1" Type="t/hyperlink" Target="https://example.com/?a=1&amp;b=2" TargetMode="External"/><Relationship Id="rId2" Type="t/image" Target="../media/a.png"/></Relationships>',
    );
    expect(parseRelationships(xml, "ppt/slides/_rels/slide1.xml.rels")).toEqual([
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
});
