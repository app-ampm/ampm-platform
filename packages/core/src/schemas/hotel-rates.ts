import { z } from "zod";

import { isoDateTime, money, uuid } from "./common.js";

/*
 * Contracts for a hotel's verified pricing (Module C, feature 9.2; docs/data-model.md §5, AC-04). Rate
 * cards carry indicative rate items (ranges: amount..amountMax) and are CLIENT-visible only when the card
 * is `verified` and the item is `client_visible`. A card cannot be verified without a verification record
 * (AC-04.4); the freshness job turns a stale verification's cards `stale` (AC-04.3). `source` and
 * `internal_notes` on a card are RESTRICTED — these are the STAFF views; the client discovery view (with
 * the "verified / stale / rates on request" labels) is a later slice. Confirmed quotations are Module D.
 */

export const hotelRateCardStatus = z.enum(["draft", "verified", "stale", "retired"]);
export type HotelRateCardStatus = z.infer<typeof hotelRateCardStatus>;

export const hotelRateItemType = z.enum([
  "room_rate",
  "venue_rental",
  "per_plate_veg",
  "per_plate_non_veg",
  "wedding_package",
  "beverage_package",
  "service_charge",
  "tax",
  "other",
]);
export type HotelRateItemType = z.infer<typeof hotelRateItemType>;

export const hotelRateItemUnit = z.enum(["per_night", "per_plate", "per_event", "percent"]);
export type HotelRateItemUnit = z.infer<typeof hotelRateItemUnit>;

export const hotelVerificationFieldGroup = z.enum([
  "profile",
  "rooms",
  "venues",
  "rates",
  "availability",
  "media",
  "contacts",
]);
export type HotelVerificationFieldGroup = z.infer<typeof hotelVerificationFieldGroup>;

export const hotelVerificationSource = z.enum([
  "phone",
  "email",
  "site_visit",
  "website",
  "contract",
]);
export type HotelVerificationSource = z.infer<typeof hotelVerificationSource>;

export const hotelVerificationStatus = z.enum(["verified", "unverified", "stale"]);
export type HotelVerificationStatus = z.infer<typeof hotelVerificationStatus>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "a calendar date in YYYY-MM-DD form");

// --- Verifications (data-model.md §5; hotels.verifications) ---

export const verificationView = z
  .object({
    id: uuid,
    hotelId: uuid,
    fieldGroup: hotelVerificationFieldGroup,
    verifiedAt: isoDateTime.nullable(),
    verifiedBy: uuid.nullable(),
    source: hotelVerificationSource.nullable(),
    status: hotelVerificationStatus,
    nextDueAt: isoDateTime.nullable(),
    notes: z.string().nullable(),
  })
  .strict();
export type VerificationView = z.infer<typeof verificationView>;

/** Record that AMPM verified a field group now (status becomes `verified`, verified_at defaults to now). */
export const verificationCreateRequest = z
  .object({
    fieldGroup: hotelVerificationFieldGroup,
    source: hotelVerificationSource,
    verifiedAt: isoDateTime.optional(),
    nextDueAt: isoDateTime.optional(),
    notes: z.string().trim().max(10_000).nullish(),
  })
  .strict();
export type VerificationCreateRequest = z.infer<typeof verificationCreateRequest>;

// --- Rate items (data-model.md §5; hotels.rate_cards_rate_items) ---

export const rateItemView = z
  .object({
    id: uuid,
    rateCardId: uuid,
    itemType: hotelRateItemType,
    roomCategoryId: uuid.nullable(),
    venueId: uuid.nullable(),
    amount: money, // the single value, or the lower bound of a range
    amountMax: money.nullable(), // the upper bound of an indicative range (Q9)
    isIndicative: z.boolean(),
    unit: hotelRateItemUnit,
    minQuantity: z.number().int().nullable(),
    inclusionsText: z.string().nullable(),
    clientVisible: z.boolean(),
  })
  .strict();
export type RateItemView = z.infer<typeof rateItemView>;

const rateItemFields = {
  itemType: hotelRateItemType,
  roomCategoryId: uuid.nullish(),
  venueId: uuid.nullish(),
  amount: money,
  amountMax: money.nullish(),
  isIndicative: z.boolean(),
  unit: hotelRateItemUnit,
  minQuantity: z.number().int().min(0).nullish(),
  inclusionsText: z.string().trim().max(10_000).nullish(),
  clientVisible: z.boolean(),
};

export const rateItemCreateRequest = z
  .object({
    ...rateItemFields,
    isIndicative: z.boolean().default(true),
    clientVisible: z.boolean().default(false),
  })
  .strict()
  .refine(
    (v) => v.amountMax == null || v.amountMax.minor >= v.amount.minor,
    "amountMax must be at least amount",
  );
export type RateItemCreateRequest = z.infer<typeof rateItemCreateRequest>;

export const rateItemUpdateRequest = z
  .object(rateItemFields)
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "at least one field is required")
  .refine(
    (v) => v.amountMax == null || v.amount == null || v.amountMax.minor >= v.amount.minor,
    "amountMax must be at least amount",
  );
export type RateItemUpdateRequest = z.infer<typeof rateItemUpdateRequest>;

// --- Rate cards (data-model.md §5) ---

export const rateCardView = z
  .object({
    id: uuid,
    hotelId: uuid,
    name: z.string(),
    validFrom: isoDate.nullable(),
    validTo: isoDate.nullable(),
    currency: z.string(),
    status: hotelRateCardStatus,
    verificationId: uuid.nullable(),
    source: z.string().nullable(), // RESTRICTED
    internalNotes: z.string().nullable(), // RESTRICTED
    items: z.array(rateItemView),
  })
  .strict();
export type RateCardView = z.infer<typeof rateCardView>;

const rateCardFields = {
  name: z.string().trim().min(1).max(255),
  validFrom: isoDate.nullish(),
  validTo: isoDate.nullish(),
  currency: z.string().trim().length(3).toUpperCase(),
  source: z.string().trim().max(10_000).nullish(),
  internalNotes: z.string().trim().max(10_000).nullish(),
};

export const rateCardCreateRequest = z
  .object({ ...rateCardFields, currency: z.string().trim().length(3).toUpperCase().default("INR") })
  .strict();
export type RateCardCreateRequest = z.infer<typeof rateCardCreateRequest>;

export const rateCardUpdateRequest = z
  .object(rateCardFields)
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "at least one field is required");
export type RateCardUpdateRequest = z.infer<typeof rateCardUpdateRequest>;

/** Verify a rate card against a recorded verification (AC-04.4): draft/stale -> verified. */
export const rateCardVerifyRequest = z.object({ verificationId: uuid }).strict();
export type RateCardVerifyRequest = z.infer<typeof rateCardVerifyRequest>;
