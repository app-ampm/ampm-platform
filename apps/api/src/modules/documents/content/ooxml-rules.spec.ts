import { describe, expect, it } from "vitest";

import type { Relationship } from "./ooxml-parts.js";
import {
  isScannedXml,
  mainPartOf,
  ooxmlRelationship,
  refuseContentType,
  refuseRelationship,
} from "./ooxml-rules.js";
import { refusalOf } from "./testing/refusals.js";

const T = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const S = "http://purl.oclc.org/ooxml/officeDocument/relationships";
const rel = (type: string, target: string, external = false): Relationship => ({
  source: "a.xml",
  type,
  target,
  external,
});

describe("ooxml-rules", () => {
  it("reads a relationship type in either namespace, without case", () => {
    expect(ooxmlRelationship(`${T}/officeDocument`)).toBe("officedocument");
    expect(ooxmlRelationship(`${S}/officeDocument`)).toBe("officedocument");
    expect(ooxmlRelationship("http://example.com/other")).toBeNull();
  });

  it("decides the kind by the main part's content type", () => {
    expect(
      mainPartOf("application/vnd.openxmlformats-officedocument.presentationml.slideshow.main+xml"),
    ).toEqual({ kind: "ppsx" });
    expect(mainPartOf("application/vnd.ms-excel.template.macroenabled.main+xml")).toEqual({
      macroOf: "xltx",
    });
    expect(mainPartOf("application/vnd.ms-word.template.macroenabledtemplate.main+xml")).toEqual({
      word: true,
    });
    expect(mainPartOf("application/vnd.ms-package.xps-fixeddocumentsequence+xml")).toBeNull();
  });

  it.each([
    ["application/vnd.ms-office.vbaproject", "macros"],
    ["application/vnd.ms-office.vbaprojectsignaturev3", "macros"],
    ["application/vnd.ms-office.activex", "active_content"],
    ["application/vnd.ms-office.webextensiontaskpanes+xml", "active_content"],
    [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.connections+xml",
      "external_content",
    ],
  ])("refuses a part of type %s", async (type, reason) => {
    expect((await refusalOf(() => refuseContentType("x", type))).reason).toBe(reason);
  });

  it("lets ordinary content types through", () => {
    expect(() => refuseContentType("x", "application/xml")).not.toThrow();
    expect(() => refuseContentType("x", "image/png")).not.toThrow();
  });

  it.each([
    [rel(`${T}/oleObject`, "embeddings/a.bin"), "active_content"],
    [rel(`${S}/control`, "activeX/a.xml"), "active_content"],
    [
      rel(
        "http://schemas.microsoft.com/office/2006/relationships/xlExternalLinkPath/xlPathMissing",
        "x",
        true,
      ),
      "external_content",
    ],
    [rel(`${T}/image`, "\\\\server\\share\\a.png"), "external_content"],
    [rel(`${T}/hyperlink`, "ftp://example.com/a", true), "external_content"],
  ])("refuses %j", async (relationship, reason) => {
    expect((await refusalOf(() => refuseRelationship(relationship))).reason).toBe(reason);
  });

  it("allows internal parts and http, https and mailto hyperlinks", () => {
    expect(() => refuseRelationship(rel(`${T}/image`, "../media/a.png"))).not.toThrow();
    expect(() =>
      refuseRelationship(rel(`${S}/hyperlink`, "mailto:a@example.com", true)),
    ).not.toThrow();
  });

  it("scans XML parts and VML drawings, not images", () => {
    expect(
      isScannedXml("application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"),
    ).toBe(true);
    expect(isScannedXml("application/vnd.openxmlformats-officedocument.vmldrawing")).toBe(true);
    expect(isScannedXml("image/svg+xml")).toBe(false);
    expect(isScannedXml("image/png")).toBe(false);
  });
});
