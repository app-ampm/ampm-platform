import { describe, expect, it } from "vitest";

import { inspectOoxml } from "./ooxml.js";
import { CFB_SIGNATURE } from "./sniff.js";
import {
  buildPackage,
  type PackageOptions,
  TRANSITIONAL_RELS as T,
} from "./testing/ooxml-builder.js";
import { EVERY_KIND, refusalOf } from "./testing/refusals.js";
import { writeZip } from "./testing/zip-writer.js";

const P = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const A = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
const slide = (inner: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?><p:sld ${P} ${A}><p:cSld><p:spTree>${inner}</p:spTree></p:cSld></p:sld>`;
const action = (value: string): string =>
  slide(
    `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Banquet Hall A"><a:hlinkClick r:id="" action="${value}"/></p:cNvPr></p:nvSpPr></p:sp>`,
  );
const sheet = (inner: string): string =>
  `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">${inner}</row></sheetData></worksheet>`;

describe("inspectOoxml: PowerPoint program actions (D-187 §2)", () => {
  it.each([
    "ppaction://program",
    "ppaction://macro?name=Run",
    "ppaction://ole?verb=0",
    "&#112;paction://macro?name=Run",
    "PPACTION://PROGRAM",
    "ppaction&#x3a;//ole?verb=1",
  ])("refuses the action %s", async (value) => {
    const refusal = await refusalOf(
      inspectOoxml(buildPackage({ body: action(value) }), EVERY_KIND),
    );
    expect(refusal.reason).toBe("active_content");
  });

  it.each([
    "ppaction://hlinksldjump",
    "ppaction://hlinkshowjump?jump=nextslide",
    "ppaction://noaction",
  ])("accepts the navigation action %s", async (value) => {
    await expect(inspectOoxml(buildPackage({ body: action(value) }), EVERY_KIND)).resolves.toBe(
      "pptx",
    );
  });

  it("finds an action split across inflated chunks", async () => {
    const padding = `<p:sp>${"<a:t>Sample Hotel</a:t>".repeat(4000)}</p:sp>`;
    const body = slide(`${padding}<a:hlinkClick action="ppaction://macro?name=x"/>`);
    const refusal = await refusalOf(inspectOoxml(buildPackage({ body }), EVERY_KIND));
    expect(refusal.reason).toBe("active_content");
  });
});

describe("inspectOoxml: DDE formulas in worksheets", () => {
  it.each([
    ["a cell formula", sheet(`<c r="A1"><f>cmd|' /C calc'!A0</f></c>`)],
    ["an encoded pipe", sheet(`<c r="A1"><f>cmd&#124;' /C calc'!A0</f></c>`)],
    ["a CDATA formula", sheet(`<c r="A1"><f><![CDATA[msexcel|'\\..\\x'!A1]]></f></c>`)],
    ["a quoted application", sheet(`<c r="A1"><f>'cmd'|'/c calc'!A0</f></c>`)],
    ["a prefixed formula element", sheet(`<c r="A1"><x:f>cmd|'x'!A0</x:f></c>`)],
  ])("refuses %s", async (_name, body) => {
    const refusal = await refusalOf(inspectOoxml(buildPackage({ kind: "xlsx", body }), EVERY_KIND));
    expect(refusal.reason).toBe("external_content");
  });

  it("refuses a DDE formula in a defined name and in a data validation rule", async () => {
    for (const body of [
      sheet("").replace(
        "<sheetData>",
        "<definedNames><definedName name=\"x\">cmd|'/c x'!A0</definedName></definedNames><sheetData>",
      ),
      sheet("").replace(
        "</worksheet>",
        "<dataValidations><dataValidation><formula1>cmd|'x'!A1</formula1></dataValidation></dataValidations></worksheet>",
      ),
    ]) {
      const refusal = await refusalOf(
        inspectOoxml(buildPackage({ kind: "xlsx", body }), EVERY_KIND),
      );
      expect(refusal.reason).toBe("external_content");
    }
  });

  it("refuses a sheet that ends inside a formula as damaged, never skipping its DDE check", async () => {
    const body = `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1"><f>cmd|' /C calc'!A0`;
    const refusal = await refusalOf(inspectOoxml(buildPackage({ kind: "xlsx", body }), EVERY_KIND));
    expect(refusal.reason).toBe("file_damaged");
  });

  it.each(["calculatedColumnFormula", "totalsRowFormula"])(
    "refuses a DDE formula in a table's %s",
    async (element) => {
      const table = {
        name: "xl/tables/table1.xml",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml",
        data: `<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="1" name="Halls" ref="A1:B3"><tableColumns count="2"><tableColumn id="1" name="Hall"/><tableColumn id="2" name="Rate"><${element}>cmd|' /C calc'!A0</${element}></tableColumn></tableColumns></table>`,
      };
      const pkg = buildPackage({ kind: "xlsx", parts: [table] });
      expect((await refusalOf(inspectOoxml(pkg, EVERY_KIND))).reason).toBe("external_content");
    },
  );

  it("accepts a pipe inside a formula's string literal", async () => {
    const body = sheet(`<c r="A1"><f>CONCAT("Hall A | Hall B", "x""|""y")</f></c>`);
    await expect(inspectOoxml(buildPackage({ kind: "xlsx", body }), EVERY_KIND)).resolves.toBe(
      "xlsx",
    );
  });
});

/** A pptx with a chart that embeds `inner` as its workbook (a `package` relationship). */
function withEmbedded(
  inner: Buffer,
  type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
): PackageOptions {
  return {
    parts: [
      {
        name: "ppt/charts/chart1.xml",
        data: "<c:chartSpace/>",
        contentType: "application/vnd.openxmlformats-officedocument.drawingml.chart+xml",
      },
      { name: "ppt/embeddings/Workbook1.xlsx", data: inner, contentType: type },
    ],
    relationships: [
      { source: "ppt/slides/slide1.xml", type: `${T}/chart`, target: "../charts/chart1.xml" },
      {
        source: "ppt/charts/chart1.xml",
        type: `${T}/package`,
        target: "../embeddings/Workbook1.xlsx",
      },
    ],
  };
}

describe("inspectOoxml: embedded packages, one level deep", () => {
  it("accepts a chart's workbook", async () => {
    const pkg = buildPackage(withEmbedded(buildPackage({ kind: "xlsx" })));
    await expect(inspectOoxml(pkg, EVERY_KIND)).resolves.toBe("pptx");
  });

  it.each<[string, Buffer, string]>([
    ["a macro-enabled workbook", buildPackage({ kind: "xlsm" }), "macros"],
    ["a Word document", buildPackage({ kind: "docx" }), "active_content"],
    [
      "a ZIP that is not an Office package",
      writeZip([{ name: "a.txt", data: "x" }]),
      "active_content",
    ],
    ["a compound file", Buffer.concat([CFB_SIGNATURE, Buffer.alloc(504)]), "active_content"],
    [
      "a workbook with a DDE formula",
      buildPackage({ kind: "xlsx", body: sheet("<c><f>cmd|'x'!A0</f></c>") }),
      "external_content",
    ],
    [
      "a workbook with its own embedded package",
      buildPackage(withEmbedded(buildPackage({ kind: "xlsx" }))),
      "active_content",
    ],
  ])("refuses an embedded %s", async (_name, inner, reason) => {
    const refusal = await refusalOf(inspectOoxml(buildPackage(withEmbedded(inner)), EVERY_KIND));
    expect(refusal.reason).toBe(reason);
  });

  it("refuses a part that is a package without being linked as one", async () => {
    const hidden = {
      name: "ppt/media/image1.png",
      data: buildPackage({ kind: "xlsx" }),
      contentType: "image/png",
    };
    const refusal = await refusalOf(inspectOoxml(buildPackage({ parts: [hidden] }), EVERY_KIND));
    expect(refusal.reason).toBe("active_content");
  });

  it("refuses a part that is a compound file whatever its content type", async () => {
    const ole = {
      name: "ppt/media/image2.png",
      data: Buffer.concat([CFB_SIGNATURE, Buffer.alloc(56)]),
      contentType: "image/png",
    };
    const refusal = await refusalOf(inspectOoxml(buildPackage({ parts: [ole] }), EVERY_KIND));
    expect(refusal.reason).toBe("active_content");
  });
});
