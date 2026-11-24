import { Injectable } from "@nestjs/common";
import type { HotelImportChangedField } from "@ampm/core";

import type { Prisma } from "../../generated/prisma/client.js";
import { AuditService } from "../../policy/audit.service.js";
import type { ImportJobRef } from "./hotel-import.kinds.js";
import type { NewRateCard, RateRowPlan } from "./hotel-import.rates-plan.js";
import { HotelRatesRepository } from "./hotel-rates.repository.js";

/*
 * The writes of a Rates import (D-170, D-184; Slice 4), inside its transaction, through the staff rates
 * repository: each new card first (a draft in rupees, made by the uploader), then its items, then the
 * stored cards' new and changed items. A new item is hidden (the plan sets `clientVisible` false) and a
 * changed one keeps its visibility, so nothing reaches a client before a card is verified in the staff
 * app. Each card and item written has one audit event naming the fields it set or changed, never their
 * values; an unchanged or refused row writes nothing.
 */

/** The card's own columns among a creating row's changed fields; the rest are its item's. */
const CARD_FIELDS = new Set<string>(["cardName", "validFrom", "validTo"]);

type CreatePlan = Extract<RateRowPlan, { readonly outcome: "create" }>;

const isNewCardRow = (plan: RateRowPlan): boolean =>
  plan.outcome === "create" && plan.card.kind === "new";

@Injectable()
export class RateRowsWriter {
  constructor(
    private readonly rates: HotelRatesRepository,
    private readonly audit: AuditService,
  ) {}

  /**
   * Writes an import's re-planned rows: the new cards' rows first, then the stored cards', each in file
   * order.
   *
   * @example
   * await writer.writeRows(plans, { importJobId, actorId }, tx);
   */
  async writeRows(
    plans: readonly RateRowPlan[],
    job: ImportJobRef,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const madeCards = new Map<string, string>();
    const ordered = [...plans.filter(isNewCardRow), ...plans.filter((plan) => !isNewCardRow(plan))];
    for (const plan of ordered) {
      if (plan.outcome === "create") await this.create(plan, madeCards, job, tx);
      if (plan.outcome !== "update") continue;
      await this.rates.updateItem(plan.targetId, plan.patch, job.actorId, tx);
      const subject = {
        hotelId: plan.hotelId,
        rateCardId: plan.cardId,
        itemType: plan.item.itemType,
      };
      await this.auditItem("update", plan.targetId, subject, plan.changedFields, job, tx);
    }
  }

  /** A new item, in its stored card or in the new card its rows share (made at the first of them). */
  private async create(
    plan: CreatePlan,
    madeCards: Map<string, string>,
    job: ImportJobRef,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const { card } = plan;
    let cardId = card.kind === "stored" ? card.cardId : madeCards.get(card.key);
    if (cardId === undefined && card.kind === "new") {
      cardId = await this.createCard(plan.hotelId, card, job, tx);
      madeCards.set(card.key, cardId);
    }
    if (cardId === undefined) return;
    const item = await this.rates.createItem(cardId, plan.data, job.actorId, tx);
    const itemFields = plan.changedFields.filter((field) => !CARD_FIELDS.has(field));
    const subject = { hotelId: plan.hotelId, rateCardId: cardId, itemType: plan.data.itemType };
    await this.auditItem("create", item.id, subject, itemFields, job, tx);
  }

  /** A new draft card in rupees, made by the uploader, audited by the fields it sets. */
  private async createCard(
    hotelId: string,
    card: NewRateCard,
    job: ImportJobRef,
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const request = {
      name: card.name,
      validFrom: card.validFrom,
      validTo: card.validTo,
      currency: "INR",
    };
    const id = await this.rates.createCard(hotelId, request, job.actorId, tx);
    const changedFields: HotelImportChangedField[] = ["cardName"];
    if (card.validFrom !== null) changedFields.push("validFrom");
    if (card.validTo !== null) changedFields.push("validTo");
    const after = {
      hotelId,
      name: card.name,
      source: "import",
      importJobId: job.importJobId,
      changedFields,
    };
    const event = { action: "create" as const, entityType: "hotel_rate_card", entityId: id };
    await this.audit.record({ ...event, before: null, after, maskImages: false }, tx);
    return id;
  }

  /** An item's audit event: which card and item, and the fields written, never their values. */
  private auditItem(
    action: "create" | "update",
    entityId: string,
    subject: { readonly hotelId: string; readonly rateCardId: string; readonly itemType: string },
    changedFields: readonly HotelImportChangedField[],
    job: ImportJobRef,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const after = { ...subject, source: "import", importJobId: job.importJobId, changedFields };
    const event = { action, entityType: "hotel_rate_item", entityId };
    return this.audit.record({ ...event, before: null, after, maskImages: false }, tx);
  }
}
