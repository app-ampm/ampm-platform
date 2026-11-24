import {
  CONTENT_KINDS,
  contentKind,
  contentKindOfMimeType,
  DOCUMENT_TYPE_RULES,
  documentTypeKinds,
  documentTypeLabel,
  documentTypeMaxBytes,
  formatDay,
  HOTEL_DOCUMENT_TYPES,
  HOTEL_DOCUMENTS_MAX,
  type ContentKind,
  type HotelDocumentType,
  type HotelDocumentVersionView,
  type HotelDocumentView,
} from "@ampm/core";
import type { PickedFile } from "@ampm/ui";

/*
 * The words and rules of the staff hotel record's Documents tab (D-187 §6): the groups by type, each
 * version's line, what a type takes and the picker's filter (both read from the core rules the API
 * checks, D-187 §3), the kind and size checks before an upload, and the draft F&B card a menu starts.
 * Pure; tested beside it.
 */

const KIB = 1024;
const MIB = 1024 * 1024;

/** Each group's heading, plural; lower-cased, it is what a size limit is "for". */
const GROUP_HEADING: Readonly<Record<HotelDocumentType, string>> = {
  fact_sheet: "Fact sheets",
  menu: "Food menus",
  beverage_menu: "Beverage menus",
  floor_plan: "Floor plans",
  other: "Other documents",
};

/** How a kind of file reads to staff: by the program that makes it, not every variant of it. */
const KIND_FAMILY: Readonly<Record<ContentKind, string>> = {
  pdf: "PDF",
  jpeg: "JPEG",
  png: "PNG",
  webp: "WebP",
  gif: "GIF",
  mp4: "MP4",
  pptx: "PowerPoint",
  ppsx: "PowerPoint",
  potx: "PowerPoint",
  ppt: "PowerPoint",
  xlsx: "Excel",
  xltx: "Excel",
  xls: "Excel",
};

/** Extensions a kind's files also carry beyond the one a download is named with. */
const OTHER_EXTENSIONS: Readonly<Partial<Record<ContentKind, readonly string[]>>> = {
  jpeg: ["jpeg"],
};

const kindExtensions = (kind: ContentKind): readonly string[] => [
  CONTENT_KINDS[kind].extension,
  ...(OTHER_EXTENSIONS[kind] ?? []),
];

export interface DocumentGroup {
  readonly type: HotelDocumentType;
  readonly heading: string;
  readonly documents: readonly HotelDocumentView[];
}

/**
 * The documents by type, in the library's order (fact sheet, food menu, beverage menu, floor plan,
 * other), keeping the API's newest-first order inside each; a type without documents has no group.
 */
export function documentGroups(documents: readonly HotelDocumentView[]): DocumentGroup[] {
  return HOTEL_DOCUMENT_TYPES.map((type) => ({
    type,
    heading: GROUP_HEADING[type],
    documents: documents.filter((document) => document.documentType === type),
  })).filter((group) => group.documents.length > 0);
}

/** "PDF", "PowerPoint", "Excel": a stored version's kind, from the type its bytes were found to be. */
export function documentKindLabel(mimeType: string): string {
  const kind = contentKindOfMimeType(mimeType);
  return kind ? KIND_FAMILY[kind] : "File";
}

/**
 * Whether a version opens in the browser: a PDF or an image, which the link serves inline; an Office
 * file is served as a download (D-187 §5), so its action says Download.
 */
export function opensInBrowser(mimeType: string): boolean {
  const kind = contentKindOfMimeType(mimeType);
  return kind === "pdf" || kind === "jpeg" || kind === "png";
}

/** "2.4 MB", "820 KB", "512 bytes". */
export function documentSizeText(bytes: number): string {
  if (bytes >= MIB) return `${Math.round((bytes / MIB) * 10) / 10} MB`;
  if (bytes >= KIB) return `${Math.round(bytes / KIB)} KB`;
  return bytes === 1 ? "1 byte" : `${bytes} bytes`;
}

/** A cap as the limits are written: "20 MB" (every cap is a whole number of mebibytes). */
const megabytes = (bytes: number): string => `${Math.round(bytes / MIB)} MB`;

/** "PDF · 1.2 MB · 3 OCT 2026": a version's kind, size and the day it was uploaded. */
export function versionFacts(version: HotelDocumentVersionView): string {
  return [
    documentKindLabel(version.mimeType),
    documentSizeText(version.sizeBytes),
    formatDay(version.createdAt, { style: "data" }),
  ].join(" · ");
}

/** "Version 2 · PDF · 2.4 MB · 12 NOV 2026": the line under a document's title. */
export function documentMeta(document: HotelDocumentVersionView): string {
  return `Version ${document.versionNumber} · ${versionFacts(document)}`;
}

/** The kinds a type takes grouped by their cap, in `contentKind` order, each family named once. */
function capGroups(
  type: HotelDocumentType,
): { readonly cap: number; readonly families: string[] }[] {
  const byCap = new Map<number, string[]>();
  for (const kind of documentTypeKinds(type)) {
    const cap = DOCUMENT_TYPE_RULES[type][kind];
    if (cap === undefined) continue;
    const families = byCap.get(cap) ?? [];
    if (!families.includes(KIND_FAMILY[kind])) families.push(KIND_FAMILY[kind]);
    byCap.set(cap, families);
  }
  return [...byCap].map(([cap, families]) => ({ cap, families }));
}

/** "PDF, JPEG or PNG": a list as a sentence says it. */
function spokenList(items: readonly string[]): string {
  const last = items[items.length - 1] ?? "";
  return items.length > 1 ? `${items.slice(0, -1).join(", ")} or ${last}` : last;
}

/** "PDF or PowerPoint": the families a type takes, each named once, in `contentKind` order. */
function typeFamilies(type: HotelDocumentType): string {
  const families: string[] = [];
  for (const kind of documentTypeKinds(type)) {
    if (!families.includes(KIND_FAMILY[kind])) families.push(KIND_FAMILY[kind]);
  }
  return spokenList(families);
}

/**
 * What a type takes, as the API checks it: "PDF, JPEG or PNG up to 20 MB, or Excel up to 10 MB".
 *
 * @example
 * documentTypeTakes("fact_sheet"); // "PDF up to 20 MB, or PowerPoint up to 25 MB"
 */
export function documentTypeTakes(type: HotelDocumentType): string {
  return capGroups(type)
    .map(({ cap, families }) => `${spokenList(families)} up to ${megabytes(cap)}`)
    .join(", or ");
}

/** Every kind the library takes, for a picker opened before a type is chosen. */
const LIBRARY_KINDS: readonly ContentKind[] = contentKind.options.filter((kind) =>
  HOTEL_DOCUMENT_TYPES.some((type) => DOCUMENT_TYPE_RULES[type][kind] !== undefined),
);

/**
 * The file picker's filter for a type: each kind's media type and extensions, so the dialog offers an
 * Office file by its extension where a browser does not know its media type. Before a type is chosen,
 * every kind the library takes. It only narrows the dialog: the server types the bytes by content.
 *
 * @example
 * documentAccept("floor_plan"); // "application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png"
 */
export function documentAccept(type: HotelDocumentType | null): string {
  const kinds = type ? documentTypeKinds(type) : LIBRARY_KINDS;
  return kinds
    .flatMap((kind) => [
      CONTENT_KINDS[kind].mimeType,
      ...kindExtensions(kind).map((extension) => `.${extension}`),
    ])
    .join(",");
}

/** The kind a picked file appears to be, by its media type or else its extension; null when neither says. */
export function pickedFileKind(file: Pick<PickedFile, "name" | "mimeType">): ContentKind | null {
  const byType = contentKindOfMimeType(file.mimeType);
  if (byType) return byType;
  const extension = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase();
  if (!extension) return null;
  return contentKind.options.find((kind) => kindExtensions(kind).includes(extension)) ?? null;
}

/**
 * Why a picked file cannot be uploaded as a type, or undefined when it can: a kind the type does not
 * take ("Floor plans take PDF, JPEG or PNG"), else a file over its kind's cap for the type (a food
 * menu's workbook, 10 MB), or over the largest file the type takes when its kind is unknown. Checked
 * before anything is sent; the server checks again after typing the bytes.
 *
 * @example
 * documentFileError("menu", picked); // "This Excel file is over the 10 MB limit for food menus"
 */
export function documentFileError(
  type: HotelDocumentType,
  file: Pick<PickedFile, "name" | "mimeType" | "sizeBytes">,
): string | undefined {
  const kind = pickedFileKind(file);
  const kindCap = kind ? DOCUMENT_TYPE_RULES[type][kind] : undefined;
  if (kind && kindCap === undefined) return `${GROUP_HEADING[type]} take ${typeFamilies(type)}`;
  const cap = kindCap ?? documentTypeMaxBytes(type);
  if (file.sizeBytes <= cap) return undefined;
  const subject = kind ? `This ${KIND_FAMILY[kind]} file` : "This file";
  return `${subject} is over the ${megabytes(cap)} limit for ${GROUP_HEADING[type].toLowerCase()}`;
}

/** Whether a type is a menu a draft F&B rate card can start from: the food and the beverage menu. */
export function isMenuType(type: HotelDocumentType): boolean {
  return type === "menu" || type === "beverage_menu";
}

/**
 * The new rate card a menu starts (D-187 §6): named after the menu, and its restricted `source` naming
 * the document and the version its prices are copied from. No rate-card column is added for it.
 *
 * @example
 * fbCardPrefill(menu); // { name: "F&B · Banquet menu", source: "Food menu v2 (document <id>)" }
 */
export function fbCardPrefill(document: HotelDocumentView): {
  readonly name: string;
  readonly source: string;
} {
  const label = documentTypeLabel(document.documentType);
  return {
    name: `F&B · ${document.title}`,
    source: `${label} v${document.versionNumber} (document ${document.id})`,
  };
}

/** The delete confirm's warning: every version of the document goes with it. */
export function deleteDocumentWarning(document: HotelDocumentView): string {
  const count = document.versions.length + 1;
  const versions = count === 1 ? "its only version" : `all ${count} of its versions`;
  const them = count === 1 ? "it" : "them";
  return `This deletes ${document.title} from the hotel with ${versions}. Nobody can open ${them} afterwards.`;
}

/** The toast once a file is filed: a new document, or the version a replacement became. */
export function uploadedMessage(document: HotelDocumentView, replaced: boolean): string {
  return replaced
    ? `${document.title} is now version ${document.versionNumber}`
    : `${document.title} uploaded`;
}

/** The toast when an upload is refused after its sheet has closed: which file was not filed. */
export function notUploadedMessage(fileName: string): string {
  return `${fileName} was not uploaded`;
}

/** "4 of 100 documents": how close the hotel is to the library's cap. */
export function documentCount(count: number): string {
  return `${count} of ${HOTEL_DOCUMENTS_MAX} documents`;
}
