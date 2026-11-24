import { Injectable } from "@nestjs/common";
import {
  errors,
  HOTEL_DOCUMENTS_MAX,
  type DocumentLinkView,
  type HotelDocumentList,
  type HotelDocumentRemovedResponse,
  type HotelDocumentUploadQuery,
  type HotelDocumentView,
} from "@ampm/core";
import { can } from "@ampm/policy";

import type { Prisma } from "../../generated/prisma/client.js";
import { type Principal, staffId, toPolicyPrincipal } from "../../policy/principal.types.js";
import {
  DocumentVersionsService,
  type OwnedDocument,
} from "../documents/document-versions.service.js";
import type { DocumentOwner } from "../documents/documents.repository.js";
import { DocumentsService } from "../documents/documents.service.js";
import { HotelDocumentsRepository } from "./hotel-documents.repository.js";
import { byType, isHotelDocument, toHotelDocumentView } from "./hotel-documents.view.js";

/** Replacing a document: what an upload that names `replaces` needs beyond the create key. */
export const HOTEL_DOCUMENTS_UPDATE = "hotels.hotel_documents.update";

const ownerOf = (hotelId: string): DocumentOwner => ({ ownerType: "hotel", ownerId: hotelId });

const tooMany = () =>
  errors.conflict(
    `A hotel can hold at most ${HOTEL_DOCUMENTS_MAX} documents: remove one, or replace one with its new version`,
  );

/**
 * A hotel's documents library (D-187 §6; permission-matrix §5.3 "Hotel documents"): the fact sheets,
 * menus, floor plans and other files a hotel sends, filed as Module N documents owned by the hotel and
 * always internal. The guard has checked the route's key; a replacement also needs the update key. Every
 * route first loads the hotel, live, so a missing or removed hotel is a 404. A file is checked, scanned
 * and stored by DocumentsService under its type's rules; a replacement becomes the next version of a
 * live, latest document of the same type; a hotel holds at most 100 live documents. Within the upload's
 * transaction the hotel's row is locked and the cap and the replacement checked again, so concurrent
 * uploads cannot pass the cap or both replace one document.
 */
@Injectable()
export class HotelDocumentsService {
  constructor(
    private readonly hotels: HotelDocumentsRepository,
    private readonly documents: DocumentsService,
    private readonly versions: DocumentVersionsService,
  ) {}

  async list(hotelId: string): Promise<HotelDocumentList> {
    await this.requireHotel(hotelId);
    const documents = await this.versions.listByOwner(ownerOf(hotelId));
    const items = documents
      .filter(isHotelDocument)
      .map((document) => toHotelDocumentView(hotelId, document));
    return { items: items.sort(byType) };
  }

  async upload(
    hotelId: string,
    query: HotelDocumentUploadQuery,
    bytes: Buffer,
    principal: Principal,
  ): Promise<HotelDocumentView> {
    await this.requireHotel(hotelId);
    const owner = ownerOf(hotelId);
    const replaced = await this.checkUpload(owner, query, principal);
    const row = await this.documents.store(
      {
        owner,
        accountId: null,
        projectId: null,
        documentType: query.type,
        title: query.title,
        bytes,
        previousVersionId: query.replaces,
      },
      staffId(principal),
      (document, tx) => this.confirmInTransaction(hotelId, query, document.id, tx),
    );
    const earlier = replaced ? [replaced.latest, ...replaced.earlier] : [];
    return toHotelDocumentView(hotelId, { latest: row, earlier });
  }

  async remove(
    hotelId: string,
    documentId: string,
    actorId: string,
  ): Promise<HotelDocumentRemovedResponse> {
    await this.requireHotel(hotelId);
    await this.versions.removeWithVersions(documentId, ownerOf(hotelId), actorId);
    return { id: documentId };
  }

  /** A 15-minute link to any live version of the hotel's documents. */
  async link(hotelId: string, documentId: string, actorId: string): Promise<DocumentLinkView> {
    await this.requireHotel(hotelId);
    return this.documents.mintLink(documentId, ownerOf(hotelId), actorId);
  }

  /**
   * Before the file is checked: a new document needs room under the cap; a replacement needs the update
   * key and a live, latest document of the same type to follow, which it returns.
   */
  private async checkUpload(
    owner: DocumentOwner,
    query: HotelDocumentUploadQuery,
    principal: Principal,
  ): Promise<OwnedDocument | null> {
    if (query.replaces === null) {
      if ((await this.versions.countLive(owner)) >= HOTEL_DOCUMENTS_MAX) throw tooMany();
      return null;
    }
    if (!can(toPolicyPrincipal(principal), HOTEL_DOCUMENTS_UPDATE)) {
      throw errors.forbidden("You cannot replace a hotel's documents");
    }
    const current = await this.versions.requireLatest(query.replaces, owner);
    if (current.latest.documentType !== query.type) {
      const message = "A replacement must be of the same type as the document it replaces";
      throw errors.validation([{ path: "replaces", message }], message);
    }
    return current;
  }

  /** Inside the upload's transaction: the hotel still live and locked, then the cap or the replacement. */
  private async confirmInTransaction(
    hotelId: string,
    query: HotelDocumentUploadQuery,
    documentId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    if (!(await this.hotels.lockLiveHotel(hotelId, tx))) throw errors.notFound("No such hotel");
    const owner = ownerOf(hotelId);
    if (query.replaces !== null) {
      await this.versions.lockLatest(query.replaces, owner, documentId, tx);
    } else if ((await this.versions.countLive(owner, tx)) > HOTEL_DOCUMENTS_MAX) {
      throw tooMany();
    }
  }

  private async requireHotel(hotelId: string): Promise<void> {
    if (!(await this.hotels.hotelExists(hotelId))) throw errors.notFound("No such hotel");
  }
}
