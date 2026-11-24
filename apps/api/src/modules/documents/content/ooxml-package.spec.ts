import { describe, expect, it } from "vitest";

import { inspectOoxml } from "./ooxml.js";
import {
  buildPackage,
  type ExtraPart,
  type ExtraRelationship,
  MS_RELS,
  type PackageOptions,
  TRANSITIONAL_RELS as T,
} from "./testing/ooxml-builder.js";
import { EVERY_KIND, refusalOf } from "./testing/refusals.js";
import { writeZip } from "./testing/zip-writer.js";

const SLIDE = "ppt/slides/slide1.xml";
const WORKBOOK = "xl/workbook.xml";
const SML = "application/vnd.openxmlformats-officedocument.spreadsheetml";

/** A hand-written package, for names the builder never writes. */
const CONTENT_TYPES =
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/></Types>';
const MAIN_RELATIONSHIP = `<Relationship Id="rId9" Type="${T}/officeDocument" Target="ppt/presentation.xml"/>`;
const relationships = (items: string): string =>
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items}</Relationships>`;

const part = (name: string, contentType?: string): ExtraPart =>
  contentType === undefined ? { name, data: "<x/>" } : { name, data: "<x/>", contentType };
const rel = (
  source: string,
  type: string,
  target: string,
  external = false,
): ExtraRelationship => ({
  source,
  type,
  target,
  external,
});
const xlsx = (options: PackageOptions): PackageOptions => ({ kind: "xlsx", ...options });

describe("inspectOoxml: refused anywhere in the package (D-187 §2)", () => {
  it.each<[string, PackageOptions, string]>([
    [
      "a VBA project",
      xlsx({
        parts: [part("xl/vbaProject.bin", "application/vnd.ms-office.vbaProject")],
        relationships: [rel(WORKBOOK, `${MS_RELS}/vbaProject`, "vbaProject.bin")],
      }),
      "macros",
    ],
    [
      "a VBA project reached only by its relationship",
      { relationships: [rel("ppt/presentation.xml", `${MS_RELS}/vbaProject`, "vbaProject.bin")] },
      "macros",
    ],
    [
      "a VBA signature",
      { parts: [part("ppt/sig.bin", "application/vnd.ms-office.vbaProjectSignatureAgile")] },
      "macros",
    ],
    [
      "an ActiveX control",
      {
        parts: [part("ppt/activeX/activeX1.xml", "application/vnd.ms-office.activeX+xml")],
        relationships: [rel(SLIDE, `${T}/control`, "../activeX/activeX1.xml")],
      },
      "active_content",
    ],
    [
      "an ActiveX binary",
      { relationships: [rel(SLIDE, `${MS_RELS}/activeXControlBinary`, "../activeX/activeX1.bin")] },
      "active_content",
    ],
    [
      "an OLE object",
      {
        parts: [
          part(
            "ppt/embeddings/oleObject1.bin",
            "application/vnd.openxmlformats-officedocument.oleObject",
          ),
        ],
      },
      "active_content",
    ],
    [
      "an OLE object relationship",
      { relationships: [rel(SLIDE, `${T}/oleObject`, "../embeddings/oleObject1.bin")] },
      "active_content",
    ],
    [
      "an Excel 4 macro sheet",
      xlsx({
        parts: [part("xl/macrosheets/sheet1.xml", "application/vnd.ms-excel.macrosheet+xml")],
        relationships: [rel(WORKBOOK, `${MS_RELS}/xlMacrosheet`, "macrosheets/sheet1.xml")],
      }),
      "macros",
    ],
    [
      "an international macro sheet",
      xlsx({
        parts: [part("xl/macrosheets/intl1.xml", "application/vnd.ms-excel.intlmacrosheet+xml")],
      }),
      "macros",
    ],
    [
      "an external link part",
      xlsx({ parts: [part("xl/externalLinks/externalLink1.xml", `${SML}.externalLink+xml`)] }),
      "external_content",
    ],
    [
      "an external link relationship",
      xlsx({
        relationships: [rel(WORKBOOK, `${T}/externalLink`, "externalLinks/externalLink1.xml")],
      }),
      "external_content",
    ],
    [
      "a data connection",
      xlsx({ relationships: [rel(WORKBOOK, `${T}/connections`, "connections.xml")] }),
      "external_content",
    ],
    [
      "a query table",
      xlsx({ parts: [part("xl/queryTables/queryTable1.xml", `${SML}.queryTable+xml`)] }),
      "external_content",
    ],
    [
      "a custom ribbon (2006)",
      { relationships: [rel("", `${MS_RELS}/ui/extensibility`, "customUI/customUI.xml")] },
      "active_content",
    ],
    [
      "a custom ribbon (2007)",
      {
        relationships: [
          rel(
            "",
            "http://schemas.microsoft.com/office/2007/relationships/ui/extensibility",
            "customUI/customUI14.xml",
          ),
        ],
      },
      "active_content",
    ],
    [
      "a customised ribbon and Quick Access Toolbar (userCustomization)",
      {
        relationships: [
          rel("", `${MS_RELS}/ui/userCustomization`, "userCustomization/customUI.xml"),
        ],
      },
      "active_content",
    ],
    [
      "a web extension (add-in)",
      {
        parts: [
          part("ppt/webextensions/webextension1.xml", "application/vnd.ms-office.webextension+xml"),
        ],
      },
      "active_content",
    ],
    [
      "an add-in task pane",
      {
        relationships: [
          rel(
            "",
            "http://schemas.microsoft.com/office/2011/relationships/webextensiontaskpanes",
            "x.xml",
          ),
        ],
      },
      "active_content",
    ],
    [
      "an externally linked picture",
      { relationships: [rel(SLIDE, `${T}/image`, "http://example.com/a.png", true)] },
      "external_content",
    ],
    [
      "an external template",
      {
        relationships: [
          rel("ppt/presentation.xml", `${T}/attachedTemplate`, "file:///c:/t.potm", true),
        ],
      },
      "external_content",
    ],
    [
      "a hyperlink to a file share",
      { relationships: [rel(SLIDE, `${T}/hyperlink`, "\\\\server\\share\\a.exe", true)] },
      "external_content",
    ],
    [
      "a hyperlink to a local program",
      { relationships: [rel(SLIDE, `${T}/hyperlink`, "file:///C:/Windows/calc.exe", true)] },
      "external_content",
    ],
    [
      "a hyperlink to a script",
      { relationships: [rel(SLIDE, `${T}/hyperlink`, "  javascript:alert(1)", true)] },
      "external_content",
    ],
    [
      "an internal target that is a URL",
      { relationships: [rel(SLIDE, `${T}/image`, "https://example.com/a.png")] },
      "external_content",
    ],
    ["a part with no content type", { parts: [part("ppt/notes.zzz")] }, "archive_unsafe"],
  ])("refuses %s", async (_name, options, reason) => {
    const refusal = await refusalOf(inspectOoxml(buildPackage(options), EVERY_KIND));
    expect(refusal.reason).toBe(reason);
  });

  it.each(["http://example.com/menu", "HTTPS://example.com/menu", "mailto:events@example.com"])(
    "accepts a hyperlink to %s",
    async (target) => {
      const pkg = buildPackage({ relationships: [rel(SLIDE, `${T}/hyperlink`, target, true)] });
      await expect(inspectOoxml(pkg, EVERY_KIND)).resolves.toBe("pptx");
    },
  );

  it.each<[string, string, string]>([
    [
      "a custom ribbon",
      `<Relationship Id="rId2" Type="${MS_RELS}/ui/extensibility" Target="customUI/customUI.xml"/>`,
      "active_content",
    ],
    [
      "a file: hyperlink",
      `<Relationship Id="rId2" Type="${T}/hyperlink" Target="file:///C:/Windows/calc.exe" TargetMode="External"/>`,
      "external_content",
    ],
  ])(
    "refuses %s in package relationships named with a percent-encoded _rels, as in _rels",
    async (_name, extra, reason) => {
      for (const relsName of ["_rels/.rels", "%5Frels/.rels"]) {
        const zip = writeZip([
          { name: "[Content_Types].xml", data: CONTENT_TYPES },
          { name: relsName, data: relationships(`${MAIN_RELATIONSHIP}${extra}`) },
          { name: "ppt/presentation.xml", data: "<main/>" },
        ]);
        expect((await refusalOf(inspectOoxml(zip, EVERY_KIND))).reason).toBe(reason);
      }
    },
  );

  it("refuses a slide's relationships named with a percent-encoded _rels, as under _rels", async () => {
    const hyperlink = `<Relationship Id="rId1" Type="${T}/hyperlink" Target="file:///C:/Windows/calc.exe" TargetMode="External"/>`;
    for (const relsName of [
      "ppt/slides/_rels/slide1.xml.rels",
      "ppt/slides/%5Frels/slide1.xml.rels",
    ]) {
      const zip = writeZip([
        { name: "[Content_Types].xml", data: CONTENT_TYPES },
        { name: "_rels/.rels", data: relationships(MAIN_RELATIONSHIP) },
        { name: "ppt/presentation.xml", data: "<main/>" },
        { name: "ppt/slides/slide1.xml", data: "<p:sld/>" },
        { name: relsName, data: relationships(hyperlink) },
      ]);
      expect((await refusalOf(inspectOoxml(zip, EVERY_KIND))).reason).toBe("external_content");
    }
  });

  it("accepts the same rules in a Strict package's namespace", async () => {
    const strict = "http://purl.oclc.org/ooxml/officeDocument/relationships";
    const pkg = buildPackage({
      kind: "xlsx",
      strict: true,
      relationships: [rel(WORKBOOK, `${strict}/externalLink`, "externalLinks/externalLink1.xml")],
    });
    expect((await refusalOf(inspectOoxml(pkg, EVERY_KIND))).reason).toBe("external_content");
  });
});
