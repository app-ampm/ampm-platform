import { Injectable } from "@nestjs/common";
import type {
  RateCardCreateRequest,
  RateCardUpdateRequest,
  RateItemCreateRequest,
  RateItemUpdateRequest,
  VerificationCreateRequest,
} from "@ampm/core";

import { PrismaService } from "../../db/prisma.service.js";
import { Prisma } from "../../generated/prisma/client.js";
import { moneyToDecimalString } from "./hotel-rates.money.js";

/*
 * Writes and reads for a hotel's verified pricing (feature 9.2). Owns the money<->Decimal mapping and the
 * card/item/verification selects the staff views map. Ownership is enforced by the controller's
 * `hotels.rate_cards_rate_items.*` / `hotels.verifications.*` keys plus the hotel/card scoping here; a
 * card cannot be set `verified` without a verification of the same hotel (the service enforces AC-04.4).
 */

const RATE_ITEM_SELECT = {
  id: true,
  rateCardId: true,
  itemType: true,
  roomCategoryId: true,
  venueId: true,
  amount: true,
  amountMax: true,
  isIndicative: true,
  unit: true,
  minQuantity: true,
  inclusionsText: true,
  clientVisible: true,
} as const;

const RATE_CARD_SELECT = {
  id: true,
  hotelId: true,
  name: true,
  validFrom: true,
  validTo: true,
  currency: true,
  status: true,
  verificationId: true,
  source: true,
  internalNotes: true,
  items: { where: { deletedAt: null }, orderBy: { itemType: "asc" }, select: RATE_ITEM_SELECT },
} as const satisfies Prisma.HotelRateCardSelect;

const VERIFICATION_SELECT = {
  id: true,
  hotelId: true,
  fieldGroup: true,
  verifiedAt: true,
  verifiedBy: true,
  source: true,
  status: true,
  nextDueAt: true,
  notes: true,
} as const;

export type RateCardRow = Prisma.HotelRateCardGetPayload<{ select: typeof RATE_CARD_SELECT }>;
export type RateItemRow = Prisma.HotelRateItemGetPayload<{ select: typeof RATE_ITEM_SELECT }>;
export type VerificationRow = Prisma.HotelVerificationGetPayload<{
  select: typeof VERIFICATION_SELECT;
}>;

function toDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  return value ? new Date(value) : null;
}

@Injectable()
export class HotelRatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async hotelExists(hotelId: string): Promise<boolean> {
    const row = await this.prisma.hotel.findFirst({
      where: { id: hotelId, deletedAt: null },
      select: { id: true },
    });
    return row !== null;
  }

  // --- Rate cards ---

  listCards(hotelId: string): Promise<RateCardRow[]> {
    return this.prisma.hotelRateCard.findMany({
      where: { hotelId, deletedAt: null },
      orderBy: [{ status: "asc" }, { name: "asc" }],
      select: RATE_CARD_SELECT,
    });
  }

  findCard(cardId: string): Promise<RateCardRow | null> {
    return this.prisma.hotelRateCard.findFirst({
      where: { id: cardId, deletedAt: null },
      select: RATE_CARD_SELECT,
    });
  }

  findCardInHotel(hotelId: string, cardId: string): Promise<{ id: string; status: string } | null> {
    return this.prisma.hotelRateCard.findFirst({
      where: { id: cardId, hotelId, deletedAt: null },
      select: { id: true, status: true },
    });
  }

  async createCard(
    hotelId: string,
    request: RateCardCreateRequest,
    actorId: string,
  ): Promise<string> {
    const row = await this.prisma.hotelRateCard.create({
      data: {
        hotelId,
        name: request.name,
        validFrom: toDate(request.validFrom) ?? null,
        validTo: toDate(request.validTo) ?? null,
        currency: request.currency,
        source: request.source ?? null,
        internalNotes: request.internalNotes ?? null,
        createdBy: actorId,
        updatedBy: actorId,
      },
      select: { id: true },
    });
    return row.id;
  }

  async updateCard(cardId: string, patch: RateCardUpdateRequest, actorId: string): Promise<void> {
    await this.prisma.hotelRateCard.update({
      where: { id: cardId },
      data: {
        name: patch.name,
        validFrom: toDate(patch.validFrom),
        validTo: toDate(patch.validTo),
        currency: patch.currency,
        source: patch.source,
        internalNotes: patch.internalNotes,
        updatedBy: actorId,
      },
    });
  }

  async setCardVerified(cardId: string, verificationId: string, actorId: string): Promise<void> {
    await this.prisma.hotelRateCard.update({
      where: { id: cardId },
      data: { status: "verified", verificationId, updatedBy: actorId },
    });
  }

  async softDeleteCard(cardId: string, actorId: string): Promise<void> {
    await this.prisma.hotelRateCard.update({
      where: { id: cardId },
      data: { deletedAt: new Date(), updatedBy: actorId },
    });
  }

  // --- Rate items ---

  createItem(
    cardId: string,
    request: RateItemCreateRequest,
    actorId: string,
  ): Promise<RateItemRow> {
    return this.prisma.hotelRateItem.create({
      data: {
        rateCardId: cardId,
        itemType: request.itemType,
        roomCategoryId: request.roomCategoryId ?? null,
        venueId: request.venueId ?? null,
        amount: moneyToDecimalString(request.amount),
        amountMax: request.amountMax ? moneyToDecimalString(request.amountMax) : null,
        isIndicative: request.isIndicative,
        unit: request.unit,
        minQuantity: request.minQuantity ?? null,
        inclusionsText: request.inclusionsText ?? null,
        clientVisible: request.clientVisible,
        createdBy: actorId,
        updatedBy: actorId,
      },
      select: RATE_ITEM_SELECT,
    });
  }

  updateItem(itemId: string, patch: RateItemUpdateRequest, actorId: string): Promise<RateItemRow> {
    return this.prisma.hotelRateItem.update({
      where: { id: itemId },
      data: {
        itemType: patch.itemType,
        roomCategoryId: patch.roomCategoryId,
        venueId: patch.venueId,
        amount: patch.amount ? moneyToDecimalString(patch.amount) : undefined,
        amountMax:
          patch.amountMax === undefined
            ? undefined
            : patch.amountMax
              ? moneyToDecimalString(patch.amountMax)
              : null,
        isIndicative: patch.isIndicative,
        unit: patch.unit,
        minQuantity: patch.minQuantity,
        inclusionsText: patch.inclusionsText,
        clientVisible: patch.clientVisible,
        updatedBy: actorId,
      },
      select: RATE_ITEM_SELECT,
    });
  }

  findItemInCard(cardId: string, itemId: string): Promise<{ id: string } | null> {
    return this.prisma.hotelRateItem.findFirst({
      where: { id: itemId, rateCardId: cardId, deletedAt: null },
      select: { id: true },
    });
  }

  async softDeleteItem(itemId: string, actorId: string): Promise<void> {
    await this.prisma.hotelRateItem.update({
      where: { id: itemId },
      data: { deletedAt: new Date(), updatedBy: actorId },
    });
  }

  // --- Verifications ---

  listVerifications(hotelId: string): Promise<VerificationRow[]> {
    return this.prisma.hotelVerification.findMany({
      where: { hotelId, deletedAt: null },
      orderBy: { verifiedAt: "desc" },
      select: VERIFICATION_SELECT,
    });
  }

  createVerification(
    hotelId: string,
    request: VerificationCreateRequest,
    actorId: string,
  ): Promise<VerificationRow> {
    return this.prisma.hotelVerification.create({
      data: {
        hotelId,
        fieldGroup: request.fieldGroup,
        source: request.source,
        status: "verified",
        verifiedAt: request.verifiedAt ? new Date(request.verifiedAt) : new Date(),
        verifiedBy: actorId,
        nextDueAt: request.nextDueAt ? new Date(request.nextDueAt) : null,
        notes: request.notes ?? null,
        createdBy: actorId,
        updatedBy: actorId,
      },
      select: VERIFICATION_SELECT,
    });
  }

  findVerificationInHotel(hotelId: string, verificationId: string): Promise<{ id: string } | null> {
    return this.prisma.hotelVerification.findFirst({
      where: { id: verificationId, hotelId, deletedAt: null },
      select: { id: true },
    });
  }

  // --- Freshness sweep (AC-04.3). ---

  /** Verifications still marked `verified` whose `verified_at` is older than the cutoff. */
  findStaleVerifications(cutoff: Date): Promise<{ id: string; hotelId: string }[]> {
    return this.prisma.hotelVerification.findMany({
      where: { status: "verified", verifiedAt: { lt: cutoff }, deletedAt: null },
      select: { id: true, hotelId: true },
    });
  }

  async markVerificationStale(id: string, tx: Prisma.TransactionClient): Promise<void> {
    await tx.hotelVerification.update({ where: { id }, data: { status: "stale" } });
  }

  /** Turn the verification's still-`verified` rate cards `stale`; returns how many moved. */
  async markCardsStaleForVerification(
    verificationId: string,
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    const result = await tx.hotelRateCard.updateMany({
      where: { verificationId, status: "verified", deletedAt: null },
      data: { status: "stale" },
    });
    return result.count;
  }

  /** Denormalise `hotels.last_verified_at` to the newest verification the hotel has (AC-04.3). */
  async recomputeLastVerifiedAt(hotelId: string, tx: Prisma.TransactionClient): Promise<void> {
    const newest = await tx.hotelVerification.aggregate({
      where: { hotelId, deletedAt: null },
      _max: { verifiedAt: true },
    });
    await tx.hotel.update({
      where: { id: hotelId },
      data: { lastVerifiedAt: newest._max.verifiedAt ?? null },
    });
  }

  /** Active staff on the hotel team (HT; roleKey `hotel_team`) — the freshness notice's recipients. */
  async hotelTeamRecipientIds(): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        status: "active",
        deletedAt: null,
        roles: { some: { role: { roleKey: "hotel_team" } } },
      },
      select: { id: true },
    });
    return users.map((user) => user.id);
  }

  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }
}
