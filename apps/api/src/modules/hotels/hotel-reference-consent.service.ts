import { Injectable } from "@nestjs/common";
import { errors, type DocumentLinkView, type WeddingReferenceView } from "@ampm/core";

import type { Prisma } from "../../generated/prisma/client.js";
import { AuditService } from "../../policy/audit.service.js";
import type { DocumentOwner } from "../documents/documents.repository.js";
import { DocumentsService } from "../documents/documents.service.js";
import {
  HotelReferencesRepository,
  type WeddingReferenceRow,
} from "./hotel-references.repository.js";
import { toWeddingReferenceView } from "./hotel-references.view.js";

/** The owner a reference's consent is filed under (polymorphic documents.owner_type/owner_id). */
const OWNER_TYPE = "hotel_wedding_reference";

const ownerOf = (reference: WeddingReferenceRow): DocumentOwner => ({
  ownerType: OWNER_TYPE,
  ownerId: reference.id,
});

/**
 * The referenced couple's consent on a previous-wedding reference (GP-20, AC-24.3), the evidence the
 * publishing gate turns on: a reference may be client-visible only with this document on file. The file
 * is stored and served by Module N's DocumentsService (D-132's pattern, a downward C→N dependency), so it
 * is typed by content, scanned, versioned on replacement and reached only through a 15-minute link. Both
 * routes load the reference inside its hotel first (the guard already checked
 * `hotels.wedding_references.update` to attach, `.read` to view). Attaching never publishes: staff set
 * the reference client-visible afterwards, as a separate, audited choice.
 */
@Injectable()
export class HotelReferenceConsentService {
  constructor(
    private readonly references: HotelReferencesRepository,
    private readonly documents: DocumentsService,
    private readonly audit: AuditService,
  ) {}

  async attach(
    hotelId: string,
    referenceId: string,
    bytes: Buffer,
    actorId: string,
  ): Promise<WeddingReferenceView> {
    const current = await this.requireReference(hotelId, referenceId);
    await this.documents.store(
      {
        owner: ownerOf(current),
        accountId: null,
        projectId: current.projectId,
        documentType: "consent",
        title: "Couple's consent to share this wedding",
        bytes,
        previousVersionId: current.consentDocumentId,
      },
      actorId,
      (document, tx) => this.pointAt(current, document.id, actorId, tx),
    );
    return toWeddingReferenceView(await this.requireReference(hotelId, referenceId));
  }

  /** Mint a 15-minute link to the reference's consent document (a `document_access_links` row). */
  async link(hotelId: string, referenceId: string, actorId: string): Promise<DocumentLinkView> {
    const current = await this.requireReference(hotelId, referenceId);
    if (!current.consentDocumentId) throw errors.notFound("No consent document is attached yet");
    return this.documents.mintLink(current.consentDocumentId, ownerOf(current), actorId);
  }

  /** Inside the document's transaction: the reference's CAS onto the new file, and its audit. */
  private async pointAt(
    current: WeddingReferenceRow,
    documentId: string,
    actorId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const changed = await this.references.attachConsent(
      current.id,
      current.consentDocumentId,
      documentId,
      actorId,
      tx,
    );
    if (changed === 0) {
      throw errors.conflict(
        "The reference changed while you were working on it; reload and try again",
      );
    }
    await this.audit.record(
      {
        action: "update",
        entityType: "hotel_wedding_reference",
        entityId: current.id,
        before: { consentDocumentId: current.consentDocumentId },
        after: { consentDocumentId: documentId },
        maskImages: false,
      },
      tx,
    );
  }

  private async requireReference(
    hotelId: string,
    referenceId: string,
  ): Promise<WeddingReferenceRow> {
    const row = await this.references.findInHotel(hotelId, referenceId);
    if (!row) throw errors.notFound("No such wedding reference");
    return row;
  }
}
