import {
  errors,
  HOTEL_DOCUMENT_TYPES,
  isHotelDocumentType,
  type HotelDocumentType,
  type HotelDocumentVersionView,
  type HotelDocumentView,
} from "@ampm/core";

import type { OwnedDocument } from "../documents/document-versions.service.js";
import type { DocumentRow } from "../documents/documents.repository.js";

/*
 * The one response model of a hotel's documents (D-187 §6): every reader of the library reads the same
 * fields, all INTERNAL. The return types are the @ampm/core views, so TypeScript rejects any extra field;
 * the storage key and checksum are never selected (documents.repository.ts).
 */

const TYPE_ORDER: ReadonlyMap<HotelDocumentType, number> = new Map(
  HOTEL_DOCUMENT_TYPES.map((type, index) => [type, index]),
);

/** A row's type, which the library's owner scope keeps to its own types (hotel-documents.service.ts). */
function hotelTypeOf(row: DocumentRow): HotelDocumentType {
  if (!isHotelDocumentType(row.documentType)) {
    throw errors.internal("A hotel document has a type the library does not file");
  }
  return row.documentType;
}

function toVersionView(row: DocumentRow): HotelDocumentVersionView {
  return {
    id: row.id,
    documentType: hotelTypeOf(row),
    title: row.title,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes ?? 0,
    versionNumber: row.versionNumber,
    createdAt: row.createdAt.toISOString(),
  };
}

/** A live hotel document: its latest version, with the earlier versions newest first. */
export function toHotelDocumentView(hotelId: string, document: OwnedDocument): HotelDocumentView {
  return {
    ...toVersionView(document.latest),
    hotelId,
    versions: document.earlier.map(toVersionView),
  };
}

/** The list's order: by type, in HOTEL_DOCUMENT_TYPES order, then as given (newest first). */
export function byType(a: HotelDocumentView, b: HotelDocumentView): number {
  return (TYPE_ORDER.get(a.documentType) ?? 0) - (TYPE_ORDER.get(b.documentType) ?? 0);
}
