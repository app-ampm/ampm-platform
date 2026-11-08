import {
  isIsoDate,
  moneyFromRupees,
  rupeesFromMinor,
  rupeesToMinor,
  type HotelRateItemType,
  type HotelRateItemUnit,
  type HotelVerificationSource,
  type RateCardCreateRequest,
  type RateCardView,
  type RateItemCreateRequest,
  type RateItemView,
  type VerificationCreateRequest,
} from "@ampm/core";

import { intOrNull, numberToText, textOrNull, wholeNumberError } from "./hotel-form-fields";

/*
 * Pure form logic for a hotel's pricing editors (feature 9.2): rate cards, their rate items and the
 * verification that publishes a card. The editors hold text (rupees, dates) and parse on submit through
 * the shared `@ampm/core` money/date helpers. Rate cards are INR only (the wire `money` type is INR), so
 * the currency is not an editable field. The server re-validates every field and is the authority.
 */

/** Blank is allowed; a non-blank value must be a real YYYY-MM-DD date. */
function isoDateError(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  return isIsoDate(trimmed) ? undefined : "Enter the date as YYYY-MM-DD";
}

// --- Rate cards ---

export interface RateCardDraft {
  readonly name: string;
  readonly validFrom: string;
  readonly validTo: string;
  readonly source: string;
  readonly internalNotes: string;
}

export function draftFromRateCard(card: RateCardView | null): RateCardDraft {
  return {
    name: card?.name ?? "",
    validFrom: card?.validFrom ?? "",
    validTo: card?.validTo ?? "",
    source: card?.source ?? "",
    internalNotes: card?.internalNotes ?? "",
  };
}

export type RateCardErrors = {
  readonly name: string | undefined;
  readonly validFrom: string | undefined;
  readonly validTo: string | undefined;
};

export function validateRateCard(draft: RateCardDraft): RateCardErrors {
  const from = draft.validFrom.trim();
  const to = draft.validTo.trim();
  // When both dates parse, a window that ends before it starts is the valid-to field's error (string
  // comparison is chronological for valid YYYY-MM-DD values), mirroring the enquiry date-range form.
  const reversed = from !== "" && to !== "" && isIsoDate(from) && isIsoDate(to) && to < from;
  return {
    name: draft.name.trim() === "" ? "Give the rate card a name" : undefined,
    validFrom: isoDateError(draft.validFrom),
    validTo:
      isoDateError(draft.validTo) ??
      (reversed ? "Valid-to must be on or after valid-from" : undefined),
  };
}

export function buildRateCardBody(draft: RateCardDraft): RateCardCreateRequest {
  return {
    name: draft.name.trim(),
    validFrom: textOrNull(draft.validFrom),
    validTo: textOrNull(draft.validTo),
    currency: "INR",
    source: textOrNull(draft.source),
    internalNotes: textOrNull(draft.internalNotes),
  };
}

// --- Rate items (amounts typed as rupees, converted to wire paise; room/venue linking is a later slice) ---

export interface RateItemDraft {
  readonly itemType: HotelRateItemType;
  readonly amount: string;
  readonly amountMax: string;
  readonly unit: HotelRateItemUnit;
  readonly isIndicative: boolean;
  readonly minQuantity: string;
  readonly inclusionsText: string;
  readonly clientVisible: boolean;
  // Room/venue links are not edited in the UI yet, but are carried so an edit never clears them.
  readonly roomCategoryId: string | null;
  readonly venueId: string | null;
}

export function draftFromRateItem(item: RateItemView | null): RateItemDraft {
  return {
    itemType: item?.itemType ?? "room_rate",
    amount: item ? rupeesFromMinor(item.amount.minor) : "",
    amountMax: item?.amountMax ? rupeesFromMinor(item.amountMax.minor) : "",
    unit: item?.unit ?? "per_night",
    isIndicative: item?.isIndicative ?? true,
    minQuantity: numberToText(item?.minQuantity ?? null),
    inclusionsText: item?.inclusionsText ?? "",
    clientVisible: item?.clientVisible ?? false,
    roomCategoryId: item?.roomCategoryId ?? null,
    venueId: item?.venueId ?? null,
  };
}

export type RateItemErrors = {
  readonly amount: string | undefined;
  readonly amountMax: string | undefined;
  readonly minQuantity: string | undefined;
};

export function validateRateItem(draft: RateItemDraft): RateItemErrors {
  const amountMinor = rupeesToMinor(draft.amount);
  const maxTrimmed = draft.amountMax.trim();
  const maxMinor = maxTrimmed === "" ? null : rupeesToMinor(maxTrimmed);
  return {
    amount:
      draft.amount.trim() === ""
        ? "Enter the amount"
        : amountMinor === null
          ? "Enter the amount in rupees, e.g. 25000"
          : undefined,
    amountMax:
      maxTrimmed === ""
        ? undefined
        : maxMinor === null
          ? "Enter the upper amount in rupees"
          : amountMinor !== null && maxMinor < amountMinor
            ? "Upper amount must be at least the amount"
            : undefined,
    minQuantity: wholeNumberError(draft.minQuantity, "Minimum quantity"),
  };
}

/** The create body from a valid draft, or null if the amount does not parse (guarded by validation). */
export function buildRateItemBody(draft: RateItemDraft): RateItemCreateRequest | null {
  const amount = moneyFromRupees(draft.amount);
  if (!amount) return null;
  const amountMax = draft.amountMax.trim() === "" ? null : moneyFromRupees(draft.amountMax);
  return {
    itemType: draft.itemType,
    roomCategoryId: draft.roomCategoryId,
    venueId: draft.venueId,
    amount,
    amountMax,
    isIndicative: draft.isIndicative,
    unit: draft.unit,
    minQuantity: intOrNull(draft.minQuantity),
    inclusionsText: textOrNull(draft.inclusionsText),
    clientVisible: draft.clientVisible,
  };
}

// --- Verifications (recorded to publish a rate card; the card verifies against one for the "rates" group) ---

export interface VerificationDraft {
  readonly source: HotelVerificationSource;
  readonly notes: string;
}

export function emptyVerificationDraft(): VerificationDraft {
  return { source: "phone", notes: "" };
}

export function buildVerificationBody(draft: VerificationDraft): VerificationCreateRequest {
  return { fieldGroup: "rates", source: draft.source, notes: textOrNull(draft.notes) };
}
