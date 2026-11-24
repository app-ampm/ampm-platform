import { hotelRateItemType, type HotelRateItemType } from "./schemas/hotel-rates.js";

/*
 * Canonical display labels for enums shared across features (code.md reuse), framework-free so each app
 * and feature uses one copy. The hotel rate-item type is read by both the staff rate-card editor and the
 * consultancy proposal lines, so its label + order live here rather than in either feature; a percent
 * item's percentage is read by the client hotel screens and the staff Rate cards tab alike.
 */

const RATE_ITEM_TYPE_LABEL: Record<HotelRateItemType, string> = {
  room_rate: "Room rate",
  venue_rental: "Venue rental",
  per_plate_veg: "Per plate (veg)",
  per_plate_non_veg: "Per plate (non-veg)",
  wedding_package: "Wedding package",
  beverage_package: "Beverage package",
  service_charge: "Service charge",
  tax: "Tax",
  other: "Other",
};

/** The rate-item types in their canonical order, for a picker. */
export const RATE_ITEM_TYPES: readonly HotelRateItemType[] = hotelRateItemType.options;

/** A rate-item type as staff read it ("Room rate"). */
export function rateItemTypeLabel(type: HotelRateItemType): string {
  return RATE_ITEM_TYPE_LABEL[type];
}

/**
 * A `percent` rate item's amounts as its percentage ("18%", "18–20%"). Such an item holds the
 * percentage in hundredths (18% is 1800), the convention the Rates import writes (D-184) and the client
 * views and the staff Rate cards tab both read, so it is labelled here once. An upper bound equal to the
 * amount shows one value.
 *
 * @example
 * ratePercentLabel({ amount: { minor: 1800 }, amountMax: null }); // "18%"
 * ratePercentLabel({ amount: { minor: 1800 }, amountMax: { minor: 2000 } }); // "18–20%"
 */
export function ratePercentLabel(item: {
  readonly amount: { readonly minor: number };
  readonly amountMax: { readonly minor: number } | null;
}): string {
  const low = item.amount.minor / 100;
  const high = item.amountMax ? item.amountMax.minor / 100 : low;
  return high === low ? `${low}%` : `${low}–${high}%`;
}
