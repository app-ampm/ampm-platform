import type { UploadRefusalReason } from "@ampm/core";

import type { OoxmlKind } from "./kinds.js";
import type { Relationship } from "./ooxml-parts.js";
import { fromFile, refuse } from "./refusal.js";

/*
 * What the OOXML check accepts and refuses (D-187 §2), by relationship type and content type, never by
 * file name. Transitional and Strict packages differ only in the namespace of the relationship types
 * (ECMA-376 Part 1 and its Strict schemas); the content types are the same in both.
 */

const TRANSITIONAL = "http://schemas.openxmlformats.org/officedocument/2006/relationships/";
const STRICT = "http://purl.oclc.org/ooxml/officedocument/relationships/";
const MICROSOFT = "http://schemas.microsoft.com/office/";

/** The last part of an OOXML relationship type in either namespace (`officeDocument`), or null. */
export function ooxmlRelationship(type: string): string | null {
  const lower = type.trim().toLowerCase();
  for (const prefix of [TRANSITIONAL, STRICT]) {
    if (lower.startsWith(prefix)) return lower.slice(prefix.length);
  }
  return null;
}

export const isOfficeDocument = (type: string): boolean =>
  ooxmlRelationship(type) === "officedocument";
export const isEmbeddedPackage = (type: string): boolean => ooxmlRelationship(type) === "package";

export type MainPart =
  { readonly kind: OoxmlKind } | { readonly macroOf: OoxmlKind } | { readonly word: true };

const PRESENTATION = "application/vnd.openxmlformats-officedocument.presentationml.";
const SPREADSHEET = "application/vnd.openxmlformats-officedocument.spreadsheetml.";
const WORD = "application/vnd.openxmlformats-officedocument.wordprocessingml.";

/** The main part's content type decides the kind (lower-cased, as `contentTypeOf` returns it). */
const MAIN_PARTS: ReadonlyMap<string, MainPart> = new Map<string, MainPart>([
  [`${PRESENTATION}presentation.main+xml`, { kind: "pptx" }],
  [`${PRESENTATION}slideshow.main+xml`, { kind: "ppsx" }],
  [`${PRESENTATION}template.main+xml`, { kind: "potx" }],
  ["application/vnd.ms-powerpoint.presentation.macroenabled.main+xml", { macroOf: "pptx" }],
  ["application/vnd.ms-powerpoint.slideshow.macroenabled.main+xml", { macroOf: "ppsx" }],
  ["application/vnd.ms-powerpoint.template.macroenabled.main+xml", { macroOf: "potx" }],
  ["application/vnd.ms-powerpoint.addin.macroenabled.main+xml", { macroOf: "pptx" }],
  [`${SPREADSHEET}sheet.main+xml`, { kind: "xlsx" }],
  [`${SPREADSHEET}template.main+xml`, { kind: "xltx" }],
  ["application/vnd.ms-excel.sheet.macroenabled.main+xml", { macroOf: "xlsx" }],
  ["application/vnd.ms-excel.template.macroenabled.main+xml", { macroOf: "xltx" }],
  ["application/vnd.ms-excel.addin.macroenabled.main+xml", { macroOf: "xlsx" }],
  ["application/vnd.ms-excel.sheet.binary.macroenabled.main", { macroOf: "xlsx" }],
  [`${WORD}document.main+xml`, { word: true }],
  [`${WORD}template.main+xml`, { word: true }],
  ["application/vnd.ms-word.document.macroenabled.main+xml", { word: true }],
  ["application/vnd.ms-word.template.macroenabledtemplate.main+xml", { word: true }],
]);

/** What a main part's content type makes the package, or null for one no slot takes (XPS, Visio). */
export function mainPartOf(contentType: string): MainPart | null {
  return MAIN_PARTS.get(contentType) ?? null;
}

/** Relationship types refused wherever they appear, in either OOXML namespace. */
const REFUSED_OOXML_RELATIONSHIPS: ReadonlyMap<string, UploadRefusalReason> = new Map([
  ["oleobject", "active_content"],
  ["control", "active_content"],
  ["externallink", "external_content"],
  ["externallinkpath", "external_content"],
  ["connections", "external_content"],
  ["querytable", "external_content"],
  ["attachedtemplate", "external_content"],
  ["subdocument", "external_content"],
  ["frame", "external_content"],
]);

/** Microsoft relationship types refused wherever they appear, matched on their path. */
const REFUSED_MICROSOFT_RELATIONSHIPS: ReadonlyArray<[string, UploadRefusalReason]> = [
  ["/vbaproject", "macros"],
  ["/wordvbadata", "macros"],
  ["/xlmacrosheet", "macros"],
  ["/xlintlmacrosheet", "macros"],
  ["/attachedtoolbars", "macros"],
  ["/keymapcustomizations", "macros"],
  ["/activexcontrolbinary", "active_content"],
  ["/ui/extensibility", "active_content"],
  ["/webextension", "active_content"],
  ["/xlexternallinkpath/", "external_content"],
];

/** Content types refused wherever a part carries them (prefixes end in "*"). */
const REFUSED_CONTENT_TYPES: ReadonlyArray<[string, UploadRefusalReason]> = [
  ["application/vnd.ms-office.vbaproject", "macros"],
  ["application/vnd.ms-office.vbaprojectsignature*", "macros"],
  ["application/vnd.ms-word.vbadata+xml", "macros"],
  ["application/vnd.ms-excel.macrosheet+xml", "macros"],
  ["application/vnd.ms-excel.intlmacrosheet+xml", "macros"],
  ["application/vnd.ms-excel.attachedtoolbars", "macros"],
  ["application/vnd.ms-word.attachedtoolbars", "macros"],
  ["application/vnd.ms-word.keymapcustomizations+xml", "macros"],
  ["application/vnd.ms-office.activex*", "active_content"],
  ["application/vnd.openxmlformats-officedocument.oleobject", "active_content"],
  ["application/vnd.ms-office.webextension*", "active_content"],
  [`${SPREADSHEET}externallink+xml`, "external_content"],
  [`${SPREADSHEET}connections+xml`, "external_content"],
  [`${SPREADSHEET}querytable+xml`, "external_content"],
];

/** Refuses a part whose content type is a macro, an active object or an external link. */
export function refuseContentType(part: string, contentType: string): void {
  for (const [pattern, reason] of REFUSED_CONTENT_TYPES) {
    const matches = pattern.endsWith("*")
      ? contentType.startsWith(pattern.slice(0, -1))
      : contentType === pattern;
    if (matches) refuse(reason, `${fromFile(part)} is ${pattern}`);
  }
}

const SAFE_LINK = /^(?:https?|mailto):/i;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Refuses a relationship of a refused type, an external target other than an http, https or mailto
 * hyperlink, and an internal target that is really a URL or a network path.
 */
export function refuseRelationship(relationship: Relationship): void {
  const { type, target, source } = relationship;
  const short = ooxmlRelationship(type);
  const lower = type.trim().toLowerCase();
  const refusedOoxml = short === null ? undefined : REFUSED_OOXML_RELATIONSHIPS.get(short);
  if (refusedOoxml) {
    refuse(
      refusedOoxml,
      `a ${short} relationship from ${source ? fromFile(source) : "the package"}`,
    );
  }
  if (lower.startsWith(MICROSOFT)) {
    const hit = REFUSED_MICROSOFT_RELATIONSHIPS.find(([path]) => lower.includes(path));
    if (hit)
      refuse(hit[1], `a ${hit[0]} relationship from ${source ? fromFile(source) : "the package"}`);
  }
  const trimmed = target.trim();
  if (relationship.external) {
    if (short === "hyperlink" && SAFE_LINK.test(trimmed)) return;
    refuse(
      "external_content",
      `an external ${fromFile(short ?? type)} target ${fromFile(trimmed)}`,
    );
  }
  if (HAS_SCHEME.test(trimmed) || trimmed.startsWith("\\\\")) {
    refuse("external_content", `an internal target that is a URL: ${fromFile(trimmed)}`);
  }
}

/** The parts scanned for program actions and DDE formulas: XML of every kind except images (SVG). */
export function isScannedXml(contentType: string): boolean {
  if (contentType.startsWith("image/")) return false;
  return (
    contentType.endsWith("xml") ||
    contentType === "application/vnd.openxmlformats-officedocument.vmldrawing"
  );
}
