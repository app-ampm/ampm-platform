import { Injectable } from "@nestjs/common";
import {
  errors,
  type RateCardCreateRequest,
  type RateCardUpdateRequest,
  type RateCardVerifyRequest,
  type RateCardView,
  type RateItemCreateRequest,
  type RateItemUpdateRequest,
  type RateItemView,
  type VerificationCreateRequest,
  type VerificationView,
} from "@ampm/core";

import { AuditService } from "../../policy/audit.service.js";
import { ConfigService } from "../admin/config/config.service.js";
import { HotelRatesRepository } from "./hotel-rates.repository.js";
import { HotelSubresourcesRepository } from "./hotel-subresources.repository.js";
import { toRateCardView, toRateItemView, toVerificationView } from "./hotel-rates.view.js";
import {
  isFutureDated,
  rateCardVerificationProblem,
  verificationNextDueAt,
} from "./rate-card-verification.js";

/**
 * Verified pricing for a hotel (HT/SA; feature 9.2). Rate cards hold indicative rate items; a card is
 * verified only against a current rates verification of the same hotel (AC-04.4 — never without one; a
 * stale, unverified, out-of-window, future-dated or other group's one is refused too), which the
 * freshness job later turns stale with its cards (AC-04.3). Every write confirms the hotel, and every
 * nested write confirms the child belongs to its parent (a mismatch is a 404). An item is for one live
 * room category or venue of its card's hotel, or neither, never both (D-184).
 */

/** The room category and venue an item is for, as stored or as a request sets them. */
interface ItemPlace {
  readonly roomCategoryId?: string | null | undefined;
  readonly venueId?: string | null | undefined;
}

const NOT_BOTH = "An item is for a room category or a venue, not both";

const isId = (value: string | null | undefined): value is string => typeof value === "string";

/**
 * The links an update changes. The staff sheet sends an item's stored links back with every edit, and a
 * room or venue removed since (a soft delete keeps the id) is no longer a live one of the hotel, so a
 * link sent back unchanged is not checked again, as a contact's stored phone is not (D-178).
 */
function changedLinks(stored: Required<ItemPlace>, patch: ItemPlace): ItemPlace {
  const changes = (field: keyof ItemPlace) =>
    patch[field] !== undefined && patch[field] !== stored[field];
  return {
    ...(changes("roomCategoryId") ? { roomCategoryId: patch.roomCategoryId } : {}),
    ...(changes("venueId") ? { venueId: patch.venueId } : {}),
  };
}
@Injectable()
export class HotelRatesService {
  constructor(
    private readonly repo: HotelRatesRepository,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly subresources: HotelSubresourcesRepository,
  ) {}

  async listCards(hotelId: string): Promise<{ items: RateCardView[] }> {
    await this.requireHotel(hotelId);
    const rows = await this.repo.listCards(hotelId);
    return { items: rows.map(toRateCardView) };
  }

  async getCard(hotelId: string, cardId: string): Promise<RateCardView> {
    await this.requireCard(hotelId, cardId);
    const row = await this.repo.findCard(cardId);
    if (!row) throw errors.notFound("No such rate card");
    return toRateCardView(row);
  }

  async createCard(
    hotelId: string,
    request: RateCardCreateRequest,
    actorId: string,
  ): Promise<RateCardView> {
    await this.requireHotel(hotelId);
    const id = await this.repo.createCard(hotelId, request, actorId);
    return this.getCard(hotelId, id);
  }

  async updateCard(
    hotelId: string,
    cardId: string,
    patch: RateCardUpdateRequest,
    actorId: string,
  ): Promise<RateCardView> {
    await this.requireCard(hotelId, cardId);
    await this.repo.updateCard(cardId, patch, actorId);
    await this.auditMutation("update", "hotel_rate_card", cardId, { updated: true });
    return this.getCard(hotelId, cardId);
  }

  async removeCard(hotelId: string, cardId: string, actorId: string): Promise<{ id: string }> {
    await this.requireCard(hotelId, cardId);
    await this.repo.softDeleteCard(cardId, actorId);
    await this.auditMutation("delete", "hotel_rate_card", cardId, { deleted: true });
    return { id: cardId };
  }

  /**
   * Link a card to a current rates verification of the same hotel and mark it verified (AC-04.4). Any
   * other verification is a 409 that names why, so the card never shows "verified" on one the freshness
   * sweep would not stale on time.
   */
  async verifyCard(
    hotelId: string,
    cardId: string,
    request: RateCardVerifyRequest,
    actorId: string,
  ): Promise<RateCardView> {
    const card = await this.requireCard(hotelId, cardId);
    if (card.status === "retired") {
      throw errors.conflict("A retired rate card cannot be verified");
    }
    await this.requireCurrentRatesVerification(hotelId, request.verificationId);
    await this.repo.setCardVerified(cardId, request.verificationId, actorId);
    await this.audit.record({
      action: "update",
      entityType: "hotel_rate_card",
      entityId: cardId,
      before: { status: card.status },
      after: { status: "verified", verificationId: request.verificationId },
      maskImages: false,
    });
    return this.getCard(hotelId, cardId);
  }

  async addItem(
    hotelId: string,
    cardId: string,
    request: RateItemCreateRequest,
    actorId: string,
  ): Promise<RateItemView> {
    await this.requireCard(hotelId, cardId);
    await this.requireItemPlace(hotelId, request, request);
    return toRateItemView(await this.repo.createItem(cardId, request, actorId));
  }

  async updateItem(
    hotelId: string,
    cardId: string,
    itemId: string,
    patch: RateItemUpdateRequest,
    actorId: string,
  ): Promise<RateItemView> {
    const stored = await this.requireItem(hotelId, cardId, itemId);
    const merged = {
      roomCategoryId:
        patch.roomCategoryId === undefined ? stored.roomCategoryId : patch.roomCategoryId,
      venueId: patch.venueId === undefined ? stored.venueId : patch.venueId,
    };
    await this.requireItemPlace(hotelId, merged, changedLinks(stored, patch));
    const row = await this.repo.updateItem(itemId, patch, actorId);
    await this.auditMutation("update", "hotel_rate_item", itemId, { itemType: row.itemType });
    return toRateItemView(row);
  }

  async removeItem(
    hotelId: string,
    cardId: string,
    itemId: string,
    actorId: string,
  ): Promise<{ id: string }> {
    await this.requireItem(hotelId, cardId, itemId);
    await this.repo.softDeleteItem(itemId, actorId);
    await this.auditMutation("delete", "hotel_rate_item", itemId, { deleted: true });
    return { id: itemId };
  }

  /**
   * Record that AMPM verified a field group, now or on a past date: never a future one, which would keep
   * the verification (and any card it backs) fresh long after its real age (AC-04.3). The server sets its
   * next_due_at (its date plus `hotel.verification_policy.maxAgeDays`) and, in the same transaction with
   * the hotel's row locked, recomputes the hotel's last_verified_at from its newest verification.
   */
  async recordVerification(
    hotelId: string,
    request: VerificationCreateRequest,
    actorId: string,
  ): Promise<VerificationView> {
    await this.requireHotel(hotelId);
    const verifiedAt = request.verifiedAt ? new Date(request.verifiedAt) : new Date();
    if (isFutureDated(verifiedAt, new Date())) {
      throw errors.validation([
        { path: "verifiedAt", message: "A verification cannot be dated in the future" },
      ]);
    }
    const { maxAgeDays } = await this.config.get("hotel.verification_policy");
    const data = {
      fieldGroup: request.fieldGroup,
      source: request.source,
      verifiedAt,
      nextDueAt: verificationNextDueAt(verifiedAt, maxAgeDays),
      notes: request.notes ?? null,
    };
    const row = await this.repo.transaction(async (tx) => {
      if (!(await this.repo.lockHotel(hotelId, tx))) throw errors.notFound("No such hotel");
      const created = await this.repo.createVerification(hotelId, data, actorId, tx);
      await this.repo.recomputeLastVerifiedAt(hotelId, tx);
      return created;
    });
    return toVerificationView(row);
  }

  async listVerifications(hotelId: string): Promise<{ items: VerificationView[] }> {
    await this.requireHotel(hotelId);
    const rows = await this.repo.listVerifications(hotelId);
    return { items: rows.map(toVerificationView) };
  }

  private auditMutation(
    action: "update" | "delete",
    entityType: string,
    entityId: string,
    after: unknown,
  ): Promise<void> {
    return this.audit.record({
      action,
      entityType,
      entityId,
      before: null,
      after,
      maskImages: false,
    });
  }

  private async requireHotel(hotelId: string): Promise<void> {
    if (!(await this.repo.hotelExists(hotelId))) throw errors.notFound("No such hotel");
  }

  /** The verification must be this hotel's and current for rates; otherwise a 409 naming why. */
  private async requireCurrentRatesVerification(
    hotelId: string,
    verificationId: string,
  ): Promise<void> {
    const verification = await this.repo.findVerificationInHotel(hotelId, verificationId);
    if (!verification) {
      throw errors.conflict("A rate card cannot be verified without a verification of this hotel");
    }
    const { maxAgeDays } = await this.config.get("hotel.verification_policy");
    const problem = rateCardVerificationProblem(verification, new Date(), maxAgeDays);
    if (problem) throw errors.conflict(problem);
  }

  private async requireCard(
    hotelId: string,
    cardId: string,
  ): Promise<{ id: string; status: string }> {
    const card = await this.repo.findCardInHotel(hotelId, cardId);
    if (!card) throw errors.notFound("No such rate card");
    return card;
  }

  private async requireItem(
    hotelId: string,
    cardId: string,
    itemId: string,
  ): Promise<{ roomCategoryId: string | null; venueId: string | null }> {
    await this.requireCard(hotelId, cardId);
    const item = await this.repo.findItemInCard(cardId, itemId);
    if (!item) throw errors.notFound("No such rate item");
    return item;
  }

  /**
   * The room category and venue a request sets must each be a live one of the card's hotel, and the item
   * (as it will be: `merged`) may not hold both; a violation answers 400 on the field the request set.
   * One that exists nowhere gets the same words as another hotel's, so nothing leaks (D-184, §5).
   */
  private async requireItemPlace(
    hotelId: string,
    merged: ItemPlace,
    request: ItemPlace,
  ): Promise<void> {
    const set = (["roomCategoryId", "venueId"] as const).filter((field) => isId(request[field]));
    if (set.length === 0) return;
    if (isId(merged.roomCategoryId) && isId(merged.venueId)) {
      throw errors.validation(set.map((path) => ({ path, message: NOT_BOTH })));
    }
    const room = request.roomCategoryId;
    if (isId(room) && !(await this.subresources.findRoomInHotel(hotelId, room))) {
      const message = "Choose a room category of this hotel";
      throw errors.validation([{ path: "roomCategoryId", message }]);
    }
    const venue = request.venueId;
    if (isId(venue) && !(await this.subresources.findVenueInHotel(hotelId, venue))) {
      throw errors.validation([{ path: "venueId", message: "Choose a venue of this hotel" }]);
    }
  }
}
