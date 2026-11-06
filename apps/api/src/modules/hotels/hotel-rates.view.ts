import type { RateCardView, RateItemView, VerificationView } from "@ampm/core";

import { decimalToMoney } from "./hotel-rates.money.js";
import type { RateCardRow, RateItemRow, VerificationRow } from "./hotel-rates.repository.js";

/*
 * Staff response models for verified pricing (feature 9.2). Amounts become the wire money shape, a
 * `@db.Date` column becomes a YYYY-MM-DD string and a timestamp becomes ISO-8601. The return types are
 * the @ampm/core views, so TypeScript rejects any extra field (the structural guarantee alongside the
 * repository's explicit selects). The client discovery rate view (with the freshness label) is a later slice.
 */

function toDateString(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function toRateItemView(row: RateItemRow): RateItemView {
  return {
    id: row.id,
    rateCardId: row.rateCardId,
    itemType: row.itemType,
    roomCategoryId: row.roomCategoryId,
    venueId: row.venueId,
    amount: decimalToMoney(row.amount),
    amountMax: row.amountMax ? decimalToMoney(row.amountMax) : null,
    isIndicative: row.isIndicative,
    unit: row.unit,
    minQuantity: row.minQuantity,
    inclusionsText: row.inclusionsText,
    clientVisible: row.clientVisible,
  };
}

export function toRateCardView(row: RateCardRow): RateCardView {
  return {
    id: row.id,
    hotelId: row.hotelId,
    name: row.name,
    validFrom: toDateString(row.validFrom),
    validTo: toDateString(row.validTo),
    currency: row.currency,
    status: row.status,
    verificationId: row.verificationId,
    source: row.source,
    internalNotes: row.internalNotes,
    items: row.items.map(toRateItemView),
  };
}

export function toVerificationView(row: VerificationRow): VerificationView {
  return {
    id: row.id,
    hotelId: row.hotelId,
    fieldGroup: row.fieldGroup,
    verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : null,
    verifiedBy: row.verifiedBy,
    source: row.source,
    status: row.status,
    nextDueAt: row.nextDueAt ? row.nextDueAt.toISOString() : null,
    notes: row.notes,
  };
}
