import { writeZip, type ZipWriterEntry } from "./zip-writer.js";

/*
 * Minimal Office packages for the OOXML specs, with synthetic content only ("Sample Hotel", "Banquet
 * Hall A"). The defaults are the smallest package PowerPoint or Excel opens; each malicious case adds
 * the part, relationship or content type it needs. Test-only: the build leaves `testing/` folders out.
 */

export const TRANSITIONAL_RELS =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
export const STRICT_RELS = "http://purl.oclc.org/ooxml/officeDocument/relationships";
export const MS_RELS = "http://schemas.microsoft.com/office/2006/relationships";

export type MainKind =
  | "pptx"
  | "ppsx"
  | "potx"
  | "pptm"
  | "ppsm"
  | "potm"
  | "ppam"
  | "xlsx"
  | "xltx"
  | "xlsm"
  | "xltm"
  | "xlam"
  | "xlsb"
  | "docx"
  | "docm"
  | "xps";

const PML = "application/vnd.openxmlformats-officedocument.presentationml";
const SML = "application/vnd.openxmlformats-officedocument.spreadsheetml";
const WML = "application/vnd.openxmlformats-officedocument.wordprocessingml";

const MAIN: Record<MainKind, { part: string; type: string }> = {
  pptx: { part: "ppt/presentation.xml", type: `${PML}.presentation.main+xml` },
  ppsx: { part: "ppt/presentation.xml", type: `${PML}.slideshow.main+xml` },
  potx: { part: "ppt/presentation.xml", type: `${PML}.template.main+xml` },
  pptm: {
    part: "ppt/presentation.xml",
    type: "application/vnd.ms-powerpoint.presentation.macroEnabled.main+xml",
  },
  ppsm: {
    part: "ppt/presentation.xml",
    type: "application/vnd.ms-powerpoint.slideshow.macroEnabled.main+xml",
  },
  potm: {
    part: "ppt/presentation.xml",
    type: "application/vnd.ms-powerpoint.template.macroEnabled.main+xml",
  },
  ppam: {
    part: "ppt/presentation.xml",
    type: "application/vnd.ms-powerpoint.addin.macroEnabled.main+xml",
  },
  xltm: {
    part: "xl/workbook.xml",
    type: "application/vnd.ms-excel.template.macroEnabled.main+xml",
  },
  xlam: { part: "xl/workbook.xml", type: "application/vnd.ms-excel.addin.macroEnabled.main+xml" },
  xlsx: { part: "xl/workbook.xml", type: `${SML}.sheet.main+xml` },
  xltx: { part: "xl/workbook.xml", type: `${SML}.template.main+xml` },
  xlsm: { part: "xl/workbook.xml", type: "application/vnd.ms-excel.sheet.macroEnabled.main+xml" },
  xlsb: {
    part: "xl/workbook.bin",
    type: "application/vnd.ms-excel.sheet.binary.macroEnabled.main",
  },
  docx: { part: "word/document.xml", type: `${WML}.document.main+xml` },
  docm: {
    part: "word/document.xml",
    type: "application/vnd.ms-word.document.macroEnabled.main+xml",
  },
  xps: {
    part: "Documents/1/FixedDoc.fdoc",
    type: "application/vnd.ms-package.xps-fixeddocument+xml",
  },
};

export interface ExtraPart {
  readonly name: string;
  readonly data: string | Buffer;
  /** An override for this part; omit it to rely on the extension's default (or none). */
  readonly contentType?: string;
}

export interface ExtraRelationship {
  /** The part the relationship belongs to; "" for the package. */
  readonly source: string;
  readonly type: string;
  readonly target: string;
  readonly external?: boolean;
}

export interface PackageOptions {
  readonly kind?: MainKind;
  readonly strict?: boolean;
  readonly parts?: readonly ExtraPart[];
  readonly relationships?: readonly ExtraRelationship[];
  /** Replaces the first content part (the slide, the sheet or the document body). */
  readonly body?: string | Buffer;
  readonly defaults?: Readonly<Record<string, string>>;
  readonly zip?: Partial<ZipWriterEntry>;
  /** Writes every entry's sizes in a data descriptor, as streaming ZIP writers (Java's) do. */
  readonly dataDescriptors?: boolean;
}

const escape = (text: string): string => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

function bodyPart(kind: MainKind, body: string | Buffer | undefined): ExtraPart {
  if (kind.startsWith("x") && kind !== "xps") {
    return {
      name: "xl/worksheets/sheet1.xml",
      contentType: `${SML}.worksheet+xml`,
      data:
        body ??
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Banquet Hall A</t></is></c><c r="B1"><f>SUM(1,2)</f><v>3</v></c></row></sheetData></worksheet>',
    };
  }
  if (kind.startsWith("d")) {
    return {
      name: "word/styles.xml",
      contentType: `${WML}.styles+xml`,
      data: body ?? "<w:styles/>",
    };
  }
  return {
    name: "ppt/slides/slide1.xml",
    contentType: `${PML}.slide+xml`,
    data:
      body ??
      '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Sample Hotel</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>',
  };
}

function relsPart(source: string, relationships: readonly ExtraRelationship[]): ZipWriterEntry {
  const slash = source.lastIndexOf("/");
  const name = `${source.slice(0, slash + 1)}_rels/${source.slice(slash + 1)}.rels`;
  const items = relationships.map(
    (rel, index) =>
      `<Relationship Id="rId${index + 1}" Type="${escape(rel.type)}" Target="${escape(rel.target)}"${rel.external ? ' TargetMode="External"' : ""}/>`,
  );
  return {
    name,
    data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.join("")}</Relationships>`,
  };
}

function contentTypes(
  parts: readonly ExtraPart[],
  defaults: Readonly<Record<string, string>>,
): string {
  const allDefaults = {
    rels: "application/vnd.openxmlformats-package.relationships+xml",
    xml: "application/xml",
    ...defaults,
  };
  const defaultTags = Object.entries(allDefaults).map(
    ([extension, type]) => `<Default Extension="${extension}" ContentType="${escape(type)}"/>`,
  );
  const overrides = parts
    .filter((part) => part.contentType !== undefined)
    .map(
      (part) =>
        `<Override PartName="/${part.name}" ContentType="${escape(part.contentType ?? "")}"/>`,
    );
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${[...defaultTags, ...overrides].join("")}</Types>`;
}

/**
 * An Office package of `kind` (pptx by default) with any extra parts and relationships.
 *
 * @example
 * const pptm = buildPackage({ kind: "pptm" });
 */
export function buildPackage(options: PackageOptions = {}): Buffer {
  const kind = options.kind ?? "pptx";
  const rels = options.strict === true ? STRICT_RELS : TRANSITIONAL_RELS;
  const main = MAIN[kind];
  const body = bodyPart(kind, options.body);
  const mainPart: ExtraPart = { name: main.part, contentType: main.type, data: "<main/>" };
  const parts = [mainPart, body, ...(options.parts ?? [])];
  const bodyTarget = body.name.slice(body.name.indexOf("/") + 1);
  const relationships: ExtraRelationship[] = [
    { source: "", type: `${rels}/officeDocument`, target: main.part },
    {
      source: main.part,
      type: `${rels}/${kind.startsWith("x") ? "worksheet" : "slide"}`,
      target: bodyTarget,
    },
    ...(options.relationships ?? []),
  ];
  const sources = [...new Set(relationships.map((rel) => rel.source))];
  const relsEntries = sources.map((source) =>
    relsPart(
      source,
      relationships.filter((rel) => rel.source === source),
    ),
  );
  const dataDescriptor = options.dataDescriptors === true;
  return writeZip([
    {
      name: "[Content_Types].xml",
      data: contentTypes(parts, options.defaults ?? {}),
      dataDescriptor,
      ...options.zip,
    },
    ...relsEntries.map((entry) => ({ ...entry, dataDescriptor })),
    ...parts.map((part) => ({ name: part.name, data: part.data, dataDescriptor })),
  ]);
}
