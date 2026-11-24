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
  type VerificationView,
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

/**
 * The draft a rate-card sheet opens with: the card being edited as it is, or a new card with what the
 * caller fills in (a menu's draft F&B card: its name and source, D-187 §6).
 *
 * @example
 * openingRateCardDraft(null, { name: "F&B · Banquet menu" }); // a new card, named
 */
export function openingRateCardDraft(
  card: RateCardView | null,
  prefill: Partial<RateCardDraft> = {},
): RateCardDraft {
  return card ? draftFromRateCard(card) : { ...draftFromRateCard(null), ...prefill };
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

/**
 * How a rate item's amount fields speak of their figure: rupees, or for a `percent` item the percentage,
 * typed as a number and kept in hundredths through the same parse (10 is 1000), the convention the Rates
 * import writes and the client views read (D-184).
 */
export interface RateAmountCopy {
  readonly symbol: string;
  readonly help: string;
  readonly invalid: string;
  readonly invalidMax: string;
}

const MONEY_COPY: RateAmountCopy = {
  symbol: "₹",
  help: "In rupees, e.g. 25000",
  invalid: "Enter the amount in rupees, e.g. 25000",
  invalidMax: "Enter the upper amount in rupees",
};

const PERCENT_COPY: RateAmountCopy = {
  symbol: "%",
  help: "The percentage as a number, e.g. 18",
  invalid: "Enter the percentage as a number, e.g. 18",
  invalidMax: "Enter the upper percentage as a number",
};

/**
 * The amount fields' words for a unit: rupees, or for `percent` the percentage.
 *
 * @example
 * `Amount (${rateAmountCopy(draft.unit).symbol})`; // "Amount (%)" while the unit is percent
 */
export function rateAmountCopy(unit: HotelRateItemUnit): RateAmountCopy {
  return unit === "percent" ? PERCENT_COPY : MONEY_COPY;
}

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
  const copy = rateAmountCopy(draft.unit);
  const amountMinor = rupeesToMinor(draft.amount);
  const maxTrimmed = draft.amountMax.trim();
  const maxMinor = maxTrimmed === "" ? null : rupeesToMinor(maxTrimmed);
  return {
    amount:
      draft.amount.trim() === ""
        ? "Enter the amount"
        : amountMinor === null
          ? copy.invalid
          : undefined,
    amountMax:
      maxTrimmed === ""
        ? undefined
        : maxMinor === null
          ? copy.invalidMax
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

/**
 * Whether a recorded verification can be offered to publish a card against: a rates one, still verified
 * and dated. The server also refuses one older than the freshness window (AC-04.4), which only it knows.
 *
 * @example
 * verifications.filter(canBackRateCard); // what the verify sheet offers to reuse
 */
export function canBackRateCard(verification: VerificationView): boolean {
  return (
    verification.fieldGroup === "rates" &&
    verification.status === "verified" &&
    verification.verifiedAt !== null
  );
}
