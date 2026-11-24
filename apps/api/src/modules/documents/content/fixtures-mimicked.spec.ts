import { describe, expect, it } from "vitest";

import { inspectContent } from "./inspect-content.js";
import {
  buildPackage,
  type ExtraPart,
  type ExtraRelationship,
  TRANSITIONAL_RELS as T,
} from "./testing/ooxml-builder.js";
import { EVERY_KIND } from "./testing/refusals.js";

/*
 * Exports from Microsoft Office, Google Slides and Sheets, and WPS Office are not available on the
 * development machine, so their package structure is mimicked here, part for part, from what those
 * producers are documented to write (apps/api/test/fixtures/content/README.md, "Mimicked"). Real exports
 * replace these at the HF gate (D-187 §2, "Fixtures").
 */

const SML = "application/vnd.openxmlformats-officedocument.spreadsheetml";
const PML = "application/vnd.openxmlformats-officedocument.presentationml";
const PACKAGE_RELS = "http://schemas.openxmlformats.org/package/2006/relationships/metadata";
const SHEET = "xl/worksheets/sheet1.xml";
const SLIDE = "ppt/slides/slide1.xml";

const docProps = (custom: boolean): { parts: ExtraPart[]; relationships: ExtraRelationship[] } => ({
  parts: [
    {
      name: "docProps/core.xml",
      data: "<cp:coreProperties/>",
      contentType: "application/vnd.openxmlformats-package.core-properties+xml",
    },
    {
      name: "docProps/app.xml",
      data: "<Properties/>",
      contentType: "application/vnd.openxmlformats-officedocument.extended-properties+xml",
    },
    ...(custom
      ? [
          {
            name: "docProps/custom.xml",
            data: '<Properties><property name="KSOProductBuildVer"><vt:lpwstr>2052-12.1.0</vt:lpwstr></property></Properties>',
            contentType: "application/vnd.openxmlformats-officedocument.custom-properties+xml",
          },
        ]
      : []),
  ],
  relationships: [
    { source: "", type: `${PACKAGE_RELS}/core-properties`, target: "docProps/core.xml" },
    { source: "", type: `${T}/extended-properties`, target: "docProps/app.xml" },
    ...(custom
      ? [{ source: "", type: `${T}/custom-properties`, target: "docProps/custom.xml" }]
      : []),
  ],
});

/** Excel: styles, shared strings, a theme, a calculation chain, shared formulas, printer settings. */
function excelLike(options: { custom?: boolean; dataDescriptors?: boolean } = {}): Buffer {
  const props = docProps(options.custom === true);
  return buildPackage({
    kind: "xlsx",
    dataDescriptors: options.dataDescriptors === true,
    defaults: { bin: `${SML}.printerSettings`, jpeg: "image/jpeg" },
    body: `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row><row r="2"><c r="A2"><v>120</v></c><c r="B2"><f t="shared" ref="B2:B3" si="0">A2*2</f><v>240</v></c></row><row r="3"><c r="A3"><v>80</v></c><c r="B3"><f t="shared" si="0"/><v>160</v></c></row></sheetData><conditionalFormatting sqref="B2:B3"><cfRule type="expression" priority="1"><formula>B2&gt;100</formula></cfRule></conditionalFormatting><hyperlinks><hyperlink ref="A1" r:id="rId1"/></hyperlinks></worksheet>`,
    parts: [
      ...props.parts,
      { name: "xl/styles.xml", data: "<styleSheet/>", contentType: `${SML}.styles+xml` },
      {
        name: "xl/sharedStrings.xml",
        data: '<sst count="1"><si><t>Banquet Hall A | Sample Hotel</t></si></sst>',
        contentType: `${SML}.sharedStrings+xml`,
      },
      {
        name: "xl/theme/theme1.xml",
        data: "<a:theme/>",
        contentType: "application/vnd.openxmlformats-officedocument.theme+xml",
      },
      {
        name: "xl/calcChain.xml",
        data: '<calcChain><c r="B2" i="1"/></calcChain>',
        contentType: `${SML}.calcChain+xml`,
      },
      { name: "xl/printerSettings/printerSettings1.bin", data: Buffer.alloc(4096) },
      { name: "docProps/thumbnail.jpeg", data: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]) },
    ],
    relationships: [
      ...props.relationships,
      { source: SHEET, type: `${T}/hyperlink`, target: "https://example.com/menu", external: true },
      {
        source: SHEET,
        type: `${T}/printerSettings`,
        target: "../printerSettings/printerSettings1.bin",
      },
      { source: "xl/workbook.xml", type: `${T}/styles`, target: "styles.xml" },
      { source: "xl/workbook.xml", type: `${T}/sharedStrings`, target: "sharedStrings.xml" },
      { source: "xl/workbook.xml", type: `${T}/theme`, target: "theme/theme1.xml" },
      { source: "xl/workbook.xml", type: `${T}/calcChain`, target: "calcChain.xml" },
      { source: "", type: `${PACKAGE_RELS}/thumbnail`, target: "docProps/thumbnail.jpeg" },
    ],
  });
}

/** PowerPoint: slide navigation actions, a web link, a picture and a chart whose data is a workbook. */
function powerPointLike(options: { dataDescriptors?: boolean } = {}): Buffer {
  const props = docProps(false);
  return buildPackage({
    kind: "pptx",
    dataDescriptors: options.dataDescriptors === true,
    defaults: { png: "image/png", xlsx: `${SML}.sheet` },
    body: '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"><a:hlinkClick r:id="" action="ppaction://hlinkshowjump?jump=nextslide"/></p:cNvPr></p:nvSpPr><p:txBody><a:p><a:r><a:rPr><a:hlinkClick r:id="rId9"/></a:rPr><a:t>Sample Hotel</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>',
    parts: [
      ...props.parts,
      {
        name: "ppt/media/image1.png",
        data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      },
      {
        name: "ppt/charts/chart1.xml",
        data: "<c:chartSpace><c:f>Sheet1!$B$1</c:f></c:chartSpace>",
        contentType: "application/vnd.openxmlformats-officedocument.drawingml.chart+xml",
      },
      { name: "ppt/embeddings/Microsoft_Excel_Worksheet.xlsx", data: excelLike() },
      {
        name: "ppt/presProps.xml",
        data: "<p:presentationPr/>",
        contentType: `${PML}.presProps+xml`,
      },
    ],
    relationships: [
      ...props.relationships,
      { source: SLIDE, type: `${T}/image`, target: "../media/image1.png" },
      {
        source: SLIDE,
        type: `${T}/hyperlink`,
        target: "https://example.com/venue",
        external: true,
      },
      { source: SLIDE, type: `${T}/chart`, target: "../charts/chart1.xml" },
      {
        source: "ppt/charts/chart1.xml",
        type: `${T}/package`,
        target: "../embeddings/Microsoft_Excel_Worksheet.xlsx",
      },
      { source: "ppt/presentation.xml", type: `${T}/presProps`, target: "presProps.xml" },
    ],
  });
}

describe("mimicked exports from producers not on this machine", () => {
  it.each<[string, Buffer, string]>([
    ["Microsoft Excel (xlsx)", excelLike(), "xlsx"],
    ["Microsoft PowerPoint with a chart workbook (pptx)", powerPointLike(), "pptx"],
    [
      "Google Sheets: every entry with a data descriptor (xlsx)",
      excelLike({ dataDescriptors: true }),
      "xlsx",
    ],
    [
      "Google Slides: every entry with a data descriptor (pptx)",
      powerPointLike({ dataDescriptors: true }),
      "pptx",
    ],
    ["WPS Spreadsheets: custom document properties (xlsx)", excelLike({ custom: true }), "xlsx"],
  ])("accepts %s", async (_name, bytes, kind) => {
    expect(await inspectContent(bytes, EVERY_KIND)).toEqual({ ok: true, kind });
  });
});
