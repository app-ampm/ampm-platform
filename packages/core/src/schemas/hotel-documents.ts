import { z } from "zod";

import { isoDateTime, storableText, uuid } from "./common.js";
import { hotelDocumentType } from "./document-types.js";

/*
 * Contracts for a hotel's documents library (D-187 §6; docs/planning/hotel-information-form-plan.md
 * §6.2 and §7.2): the fact sheets, menus, floor plans and other files a hotel sends, filed as Module N
 * documents owned by the hotel. Every one is INTERNAL, read by the Super Admin, Sales, the Hotel team
 * and project managers (permission-matrix §5.3, "Hotel documents"), so there is one response model. A
 * file is opened only through a minted 15-minute link (`documentLinkView`); its storage key and
 * checksum never reach the wire.
 *
 * The routes:
 * - `GET /hotels-admin/hotels/:hotelId/documents` → `hotelDocumentList`;
 * - `POST /hotels-admin/hotels/:hotelId/documents?type=&title=&replaces=` with the file as the raw
 *   `application/octet-stream` body → `hotelDocumentView` (201);
 * - `DELETE /hotels-admin/hotels/:hotelId/documents/:documentId` → `hotelDocumentRemovedResponse`;
 * - `POST /hotels-admin/hotels/:hotelId/documents/:documentId/link` → `documentLinkView` (201).
 */

/** The longest title a hotel document may have. */
export const HOTEL_DOCUMENT_TITLE_MAX = 120;

/** The most live documents one hotel may hold; an upload beyond it is refused with 409. */
export const HOTEL_DOCUMENTS_MAX = 100;

/**
 * The most versions one document may have, the latest included; a replacement beyond it is refused
 * with 409, so one document's history stays a bounded list (at most 100 x 50 rows per hotel).
 */
export const HOTEL_DOCUMENT_VERSIONS_MAX = 50;

/**
 * The upload's query. `type` is one of the hotel document types; `title` is trimmed, and null when
 * absent or blank: the API then keeps the title of the document a replacement follows, or names a new
 * document after its type (`documentTypeLabel`), which only it can tell apart; `replaces` names the
 * document this file replaces, which must be the latest version of a live document of the same hotel
 * and type, and the upload becomes its next version. The file itself is the request body, never part
 * of the query.
 *
 * @example
 * hotelDocumentUploadQuery.parse({ type: "menu" }); // { type: "menu", title: null, replaces: null }
 */
export const hotelDocumentUploadQuery = z
  .object({
    type: hotelDocumentType,
    title: storableText().max(HOTEL_DOCUMENT_TITLE_MAX).optional(),
    replaces: uuid.optional(),
  })
  .strict()
  .transform((query) => ({
    type: query.type,
    title: query.title ? query.title : null,
    replaces: query.replaces ?? null,
  }));
/** The query as the API reads it: `title` and `replaces` null when not given. */
export type HotelDocumentUploadQuery = z.output<typeof hotelDocumentUploadQuery>;
/** The query as a client sends it. */
export type HotelDocumentUploadQueryInput = z.input<typeof hotelDocumentUploadQuery>;

/**
 * One version of a hotel document. `mimeType` is the type detected from the file's bytes at upload
 * (`contentKindOfMimeType` names its kind).
 */
export const hotelDocumentVersionView = z
  .object({
    id: uuid,
    documentType: hotelDocumentType,
    title: z.string(),
    mimeType: z.string(),
    sizeBytes: z.number().int().min(0),
    versionNumber: z.number().int().min(1),
    createdAt: isoDateTime,
  })
  .strict();
export type HotelDocumentVersionView = z.infer<typeof hotelDocumentVersionView>;

/**
 * A live hotel document: its latest version, with the earlier versions it replaced, newest first. Its
 * `id` is what a replacement, a removal and a link name; an earlier version's `id` opens that version.
 */
export const hotelDocumentView = hotelDocumentVersionView
  .extend({
    hotelId: uuid,
    versions: z.array(hotelDocumentVersionView),
  })
  .strict();
export type HotelDocumentView = z.infer<typeof hotelDocumentView>;

/** A hotel's live documents, by type in `HOTEL_DOCUMENT_TYPES` order, then newest first. */
export const hotelDocumentList = z.object({ items: z.array(hotelDocumentView) }).strict();
export type HotelDocumentList = z.infer<typeof hotelDocumentList>;

/** The acknowledgement after removing a document with all its versions. */
export const hotelDocumentRemovedResponse = z.object({ id: uuid }).strict();
export type HotelDocumentRemovedResponse = z.infer<typeof hotelDocumentRemovedResponse>;
