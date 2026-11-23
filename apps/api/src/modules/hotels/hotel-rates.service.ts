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
import { toRateCardView, toRateItemView, toVerificationView } from "./hotel-rates.view.js";
import { isFutureDated, rateCardVerificationProblem } from "./rate-card-verification.js";

/**
 * Verified pricing for a hotel (HT/SA; feature 9.2). Rate cards hold indicative rate items; a card is
 * verified only against a current rates verification of the same hotel (AC-04.4 — never without one; a
 * stale, unverified, out-of-window, future-dated or other group's one is refused too), which the
 * freshness job later turns stale with its cards (AC-04.3). Every write confirms the hotel, and every
 * nested write confirms the child belongs to its parent (a mismatch is a 404).
 */
@Injectable()
export class HotelRatesService {
  constructor(
    private readonly repo: HotelRatesRepository,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
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
    return toRateItemView(await this.repo.createItem(cardId, request, actorId));
  }

  async updateItem(
    hotelId: string,
    cardId: string,
    itemId: string,
    patch: RateItemUpdateRequest,
    actorId: string,
  ): Promise<RateItemView> {
    await this.requireItem(hotelId, cardId, itemId);
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
   * the verification (and any card it backs) fresh long after its real age (AC-04.3).
   */
  async recordVerification(
    hotelId: string,
    request: VerificationCreateRequest,
    actorId: string,
  ): Promise<VerificationView> {
    await this.requireHotel(hotelId);
    if (request.verifiedAt && isFutureDated(new Date(request.verifiedAt), new Date())) {
      throw errors.validation([
        { path: "verifiedAt", message: "A verification cannot be dated in the future" },
      ]);
    }
    return toVerificationView(await this.repo.createVerification(hotelId, request, actorId));
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

  private async requireItem(hotelId: string, cardId: string, itemId: string): Promise<void> {
    await this.requireCard(hotelId, cardId);
    if (!(await this.repo.findItemInCard(cardId, itemId))) {
      throw errors.notFound("No such rate item");
    }
  }
}
