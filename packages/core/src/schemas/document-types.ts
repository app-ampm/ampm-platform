import { z } from "zod";

import { contentKind, type ContentKind } from "./content-kinds.js";

/*
 * Module N document types (data-model.md §16) and what each takes (D-187 §3). A stored document has one
 * type; the type decides the kinds of file the upload takes, each with its own size cap, so the API
 * checks one table and the apps name the same kinds and limits in their file pickers. The hotel
 * documents library (D-187 §6) files the hotel types below.
 */

/**
 * Every document type, as `documents.document_type` stores it.
 *
 * @example
 * documentType.parse("fact_sheet"); // "fact_sheet"
 */
export const DOCUMENT_TYPES = [
  "proposal",
  "contract",
  "invoice",
  "design",
  "menu",
  "schedule",
  "rooming_list",
  "rider",
  "ticket",
  "consent",
  "other",
  "fact_sheet",
  "beverage_menu",
  "floor_plan",
] as const;

export const documentType = z.enum(DOCUMENT_TYPES);
export type DocumentType = z.infer<typeof documentType>;

const DOCUMENT_TYPE_LABEL: Readonly<Record<DocumentType, string>> = {
  proposal: "Proposal",
  contract: "Contract",
  invoice: "Invoice",
  design: "Design",
  menu: "Food menu",
  schedule: "Schedule",
  rooming_list: "Rooming list",
  rider: "Rider",
  ticket: "Ticket",
  consent: "Consent",
  other: "Other document",
  fact_sheet: "Fact sheet",
  beverage_menu: "Beverage menu",
  floor_plan: "Floor plan",
};

/**
 * A document type as staff read it, and the title a hotel document gets when none is given.
 *
 * @example
 * documentTypeLabel("menu"); // "Food menu"
 */
export function documentTypeLabel(type: DocumentType): string {
  return DOCUMENT_TYPE_LABEL[type];
}

/** The kinds of file a document type takes, each with the most bytes a file of that kind may have. */
export type DocumentKindCaps = Readonly<Partial<Record<ContentKind, number>>>;

const MIB = 1024 * 1024;
const PDF_AND_IMAGES: DocumentKindCaps = { pdf: 20 * MIB, jpeg: 20 * MIB, png: 20 * MIB };
const MENU: DocumentKindCaps = { ...PDF_AND_IMAGES, xlsx: 10 * MIB, xltx: 10 * MIB, xls: 10 * MIB };

/**
 * What each document type takes (D-187 §3): a fact sheet as a PDF or a presentation; a food or beverage
 * menu as a PDF, an image or a workbook; every other type, the floor plan included, as a PDF, JPEG or
 * PNG, as documents always have been.
 *
 * @example
 * DOCUMENT_TYPE_RULES.fact_sheet.pptx; // 26214400 (25 MiB)
 * DOCUMENT_TYPE_RULES.floor_plan.xlsx; // undefined: a floor plan is never a workbook
 */
export const DOCUMENT_TYPE_RULES: Readonly<Record<DocumentType, DocumentKindCaps>> = {
  proposal: PDF_AND_IMAGES,
  contract: PDF_AND_IMAGES,
  invoice: PDF_AND_IMAGES,
  design: PDF_AND_IMAGES,
  menu: MENU,
  schedule: PDF_AND_IMAGES,
  rooming_list: PDF_AND_IMAGES,
  rider: PDF_AND_IMAGES,
  ticket: PDF_AND_IMAGES,
  consent: PDF_AND_IMAGES,
  other: PDF_AND_IMAGES,
  fact_sheet: { pdf: 20 * MIB, pptx: 25 * MIB, ppsx: 25 * MIB, potx: 25 * MIB, ppt: 25 * MIB },
  beverage_menu: MENU,
  floor_plan: PDF_AND_IMAGES,
};

/**
 * The kinds a document type takes, in the order of `contentKind`.
 *
 * @example
 * documentTypeKinds("floor_plan"); // ["pdf", "jpeg", "png"]
 */
export function documentTypeKinds(type: DocumentType): ContentKind[] {
  return contentKind.options.filter((kind) => DOCUMENT_TYPE_RULES[type][kind] !== undefined);
}

/**
 * The largest file a document type takes, whatever its kind: the most an upload of it may send.
 *
 * @example
 * documentTypeMaxBytes("fact_sheet"); // 26214400 (25 MiB)
 */
export function documentTypeMaxBytes(type: DocumentType): number {
  return Math.max(...Object.values(DOCUMENT_TYPE_RULES[type]));
}

/**
 * The types a hotel's documents library files (D-187 §6): the fact sheet, the food menu, the beverage
 * menu, the floor plan and anything else the hotel sends.
 *
 * @example
 * hotelDocumentType.parse("beverage_menu"); // "beverage_menu"
 */
export const HOTEL_DOCUMENT_TYPES = [
  "fact_sheet",
  "menu",
  "beverage_menu",
  "floor_plan",
  "other",
] as const satisfies readonly DocumentType[];

export const hotelDocumentType = z.enum(HOTEL_DOCUMENT_TYPES);
export type HotelDocumentType = z.infer<typeof hotelDocumentType>;

/**
 * Whether a stored document type is one the hotel documents library files.
 *
 * @example
 * isHotelDocumentType("contract"); // false
 */
export function isHotelDocumentType(value: string): value is HotelDocumentType {
  return hotelDocumentType.safeParse(value).success;
}
