import { Injectable } from "@nestjs/common";
import {
  errors,
  type WeddingReferenceClientItem,
  type WeddingReferenceCreateRequest,
  type WeddingReferenceRemovedResponse,
  type WeddingReferenceUpdateRequest,
  type WeddingReferenceView,
} from "@ampm/core";

import { AuditService } from "../../policy/audit.service.js";
import {
  HotelReferencesRepository,
  type WeddingReferenceRow,
} from "./hotel-references.repository.js";
import { toWeddingReferenceClientItem, toWeddingReferenceView } from "./hotel-references.view.js";

/** The governance snapshot audited on a reference change — the fields GP-20 compliance turns on. */
function consentImage(row: WeddingReferenceRow): Record<string, unknown> {
  return {
    clientVisible: row.clientVisible,
    consentDocumentId: row.consentDocumentId,
    projectId: row.projectId,
    eventYear: row.eventYear,
  };
}

/**
 * Previous-wedding references for a hotel (HT/SA; Module C, feature 9.3). The GP-20 publishing rule — a
 * reference may be `client_visible` only when a `consent_document_id` records the referenced couple's
 * consent — is enforced here on every create and update (AC-24.3 → 409). Create is audited by the
 * interceptor (@Audited); update and delete self-audit the consent/sharing change in one transaction
 * (security.md: a client-visible change is never observable without an audit event).
 */
@Injectable()
export class HotelReferencesService {
  constructor(
    private readonly repo: HotelReferencesRepository,
    private readonly audit: AuditService,
  ) {}

  async list(hotelId: string): Promise<{ items: WeddingReferenceView[] }> {
    await this.requireHotel(hotelId);
    const rows = await this.repo.list(hotelId);
    return { items: rows.map(toWeddingReferenceView) };
  }

  async get(hotelId: string, referenceId: string): Promise<WeddingReferenceView> {
    return toWeddingReferenceView(await this.requireReference(hotelId, referenceId));
  }

  async create(
    hotelId: string,
    request: WeddingReferenceCreateRequest,
    actorId: string,
  ): Promise<WeddingReferenceView> {
    await this.requireHotel(hotelId);
    this.assertPublishable(request.clientVisible, request.consentDocumentId ?? null);
    return toWeddingReferenceView(await this.repo.create(hotelId, request, actorId));
  }

  async update(
    hotelId: string,
    referenceId: string,
    patch: WeddingReferenceUpdateRequest,
    actorId: string,
  ): Promise<WeddingReferenceView> {
    const current = await this.requireReference(hotelId, referenceId);
    // Gate the RESULTING state, whatever the patch lands on (a visibility flip, a consent clear, both).
    // `consentDocumentId` is nullable, so an explicit null must win over the current value — hence the
    // `!== undefined` check rather than `??` (which would keep the old consent when the patch clears it).
    const nextVisible = patch.clientVisible ?? current.clientVisible;
    const nextConsent =
      patch.consentDocumentId !== undefined ? patch.consentDocumentId : current.consentDocumentId;
    this.assertPublishable(nextVisible, nextConsent);
    const row = await this.repo.transaction(async (tx) => {
      const updated = await this.repo.update(referenceId, patch, actorId, tx);
      await this.audit.record(
        {
          action: "update",
          entityType: "hotel_wedding_reference",
          entityId: referenceId,
          before: consentImage(current),
          after: consentImage(updated),
          maskImages: false,
        },
        tx,
      );
      return updated;
    });
    return toWeddingReferenceView(row);
  }

  async remove(
    hotelId: string,
    referenceId: string,
    actorId: string,
  ): Promise<WeddingReferenceRemovedResponse> {
    const current = await this.requireReference(hotelId, referenceId);
    await this.repo.transaction(async (tx) => {
      await this.repo.softDelete(referenceId, actorId, tx);
      await this.audit.record(
        {
          action: "delete",
          entityType: "hotel_wedding_reference",
          entityId: referenceId,
          before: consentImage(current), // what was removed, for a forensic trail (security.md)
          after: { deleted: true },
          maskImages: false,
        },
        tx,
      );
    });
    return { id: referenceId };
  }

  /**
   * The consented, client-visible references a hotel detail shows a client/demo principal (feature 9.3,
   * CP-05). The caller (HotelsService) has already confirmed the hotel is in the principal's reach, so this
   * only maps the rows the repository scopes to `client_visible`; no governance field crosses the boundary.
   */
  async clientReferences(hotelId: string): Promise<WeddingReferenceClientItem[]> {
    const rows = await this.repo.listClientVisible(hotelId);
    return rows.map(toWeddingReferenceClientItem);
  }

  /**
   * GP-20 / AC-24.3: a reference may be client-visible only with recorded consent (`consent_document_id`).
   * Fail closed — client visibility without a consent document is refused (409), on create and on update.
   */
  private assertPublishable(clientVisible: boolean, consentDocumentId: string | null): void {
    if (clientVisible && !consentDocumentId) {
      throw errors.conflict(
        "A previous-wedding reference needs recorded consent before client visibility (GP-20)",
      );
    }
  }

  private async requireHotel(hotelId: string): Promise<void> {
    if (!(await this.repo.hotelExists(hotelId))) throw errors.notFound("No such hotel");
  }

  private async requireReference(
    hotelId: string,
    referenceId: string,
  ): Promise<WeddingReferenceRow> {
    const row = await this.repo.findInHotel(hotelId, referenceId);
    if (!row) throw errors.notFound("No such wedding reference");
    return row;
  }
}
