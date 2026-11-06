import { Controller, Delete, Get, HttpCode, Patch, Post } from "@nestjs/common";
import {
  rateCardCreateRequest,
  rateCardUpdateRequest,
  rateCardVerifyRequest,
  rateItemCreateRequest,
  rateItemUpdateRequest,
  uuid,
  verificationCreateRequest,
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
import { z } from "zod";

import { ZodBody, ZodParams } from "../../common/zod.js";
import {
  Audited,
  CurrentPrincipal,
  RequirePermission,
  SelfAudited,
} from "../../policy/decorators.js";
import type { Principal } from "../../policy/principal.types.js";
import { HotelRatesService } from "./hotel-rates.service.js";

const hotelParam = z.object({ hotelId: uuid });
type HotelParam = z.infer<typeof hotelParam>;
const cardParam = z.object({ hotelId: uuid, cardId: uuid });
type CardParam = z.infer<typeof cardParam>;
const itemParam = z.object({ hotelId: uuid, cardId: uuid, itemId: uuid });
type ItemParam = z.infer<typeof itemParam>;

function staffId(principal: Principal): string {
  if (principal.type !== "staff") throw new Error("a staff principal is required");
  return principal.userId;
}

/**
 * Verified pricing for a hotel (HT/SA; feature 9.2), under the `hotels-admin` prefix alongside the other
 * staff hotel routes. Rate cards and items are `hotels.rate_cards_rate_items.*`; verifications are
 * `hotels.verifications.*`. Create is audited by the interceptor; update/delete/verify self-audit.
 */
@Controller("hotels-admin")
export class HotelRatesController {
  constructor(private readonly rates: HotelRatesService) {}

  @Get("hotels/:hotelId/rate-cards")
  @RequirePermission("hotels.rate_cards_rate_items.read")
  listCards(@ZodParams(hotelParam) params: HotelParam): Promise<{ items: RateCardView[] }> {
    return this.rates.listCards(params.hotelId);
  }

  @Get("hotels/:hotelId/rate-cards/:cardId")
  @RequirePermission("hotels.rate_cards_rate_items.read")
  getCard(@ZodParams(cardParam) params: CardParam): Promise<RateCardView> {
    return this.rates.getCard(params.hotelId, params.cardId);
  }

  @Post("hotels/:hotelId/rate-cards")
  @RequirePermission("hotels.rate_cards_rate_items.create")
  @HttpCode(201)
  @Audited({ entityType: "hotel_rate_card" })
  createCard(
    @ZodParams(hotelParam) params: HotelParam,
    @ZodBody(rateCardCreateRequest) body: RateCardCreateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<RateCardView> {
    return this.rates.createCard(params.hotelId, body, staffId(principal));
  }

  @Patch("hotels/:hotelId/rate-cards/:cardId")
  @RequirePermission("hotels.rate_cards_rate_items.update")
  @SelfAudited()
  updateCard(
    @ZodParams(cardParam) params: CardParam,
    @ZodBody(rateCardUpdateRequest) body: RateCardUpdateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<RateCardView> {
    return this.rates.updateCard(params.hotelId, params.cardId, body, staffId(principal));
  }

  @Delete("hotels/:hotelId/rate-cards/:cardId")
  @RequirePermission("hotels.rate_cards_rate_items.delete")
  @SelfAudited()
  removeCard(
    @ZodParams(cardParam) params: CardParam,
    @CurrentPrincipal() principal: Principal,
  ): Promise<{ id: string }> {
    return this.rates.removeCard(params.hotelId, params.cardId, staffId(principal));
  }

  @Post("hotels/:hotelId/rate-cards/:cardId/verify")
  @RequirePermission("hotels.rate_cards_rate_items.update")
  @HttpCode(200)
  @SelfAudited()
  verifyCard(
    @ZodParams(cardParam) params: CardParam,
    @ZodBody(rateCardVerifyRequest) body: RateCardVerifyRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<RateCardView> {
    return this.rates.verifyCard(params.hotelId, params.cardId, body, staffId(principal));
  }

  @Post("hotels/:hotelId/rate-cards/:cardId/items")
  @RequirePermission("hotels.rate_cards_rate_items.create")
  @HttpCode(201)
  @Audited({ entityType: "hotel_rate_item" })
  addItem(
    @ZodParams(cardParam) params: CardParam,
    @ZodBody(rateItemCreateRequest) body: RateItemCreateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<RateItemView> {
    return this.rates.addItem(params.hotelId, params.cardId, body, staffId(principal));
  }

  @Patch("hotels/:hotelId/rate-cards/:cardId/items/:itemId")
  @RequirePermission("hotels.rate_cards_rate_items.update")
  @SelfAudited()
  updateItem(
    @ZodParams(itemParam) params: ItemParam,
    @ZodBody(rateItemUpdateRequest) body: RateItemUpdateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<RateItemView> {
    return this.rates.updateItem(
      params.hotelId,
      params.cardId,
      params.itemId,
      body,
      staffId(principal),
    );
  }

  @Delete("hotels/:hotelId/rate-cards/:cardId/items/:itemId")
  @RequirePermission("hotels.rate_cards_rate_items.delete")
  @SelfAudited()
  removeItem(
    @ZodParams(itemParam) params: ItemParam,
    @CurrentPrincipal() principal: Principal,
  ): Promise<{ id: string }> {
    return this.rates.removeItem(params.hotelId, params.cardId, params.itemId, staffId(principal));
  }

  @Get("hotels/:hotelId/verifications")
  @RequirePermission("hotels.verifications.read")
  listVerifications(
    @ZodParams(hotelParam) params: HotelParam,
  ): Promise<{ items: VerificationView[] }> {
    return this.rates.listVerifications(params.hotelId);
  }

  @Post("hotels/:hotelId/verifications")
  @RequirePermission("hotels.verifications.create")
  @HttpCode(201)
  @Audited({ entityType: "hotel_verification" })
  recordVerification(
    @ZodParams(hotelParam) params: HotelParam,
    @ZodBody(verificationCreateRequest) body: VerificationCreateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<VerificationView> {
    return this.rates.recordVerification(params.hotelId, body, staffId(principal));
  }
}
