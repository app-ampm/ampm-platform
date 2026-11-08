import type { HotelRateItemType } from "./schemas/hotel-rates.js";

/*
 * Canonical display labels for enums shared across features (code.md reuse), framework-free so each app
 * and feature uses one copy. The hotel rate-item type is read by both the staff rate-card editor and the
 * consultancy proposal lines, so its label + order live here rather than in either feature.
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
export const RATE_ITEM_TYPES: readonly HotelRateItemType[] = [
  "room_rate",
  "venue_rental",
  "per_plate_veg",
  "per_plate_non_veg",
  "wedding_package",
  "beverage_package",
  "service_charge",
  "tax",
  "other",
];

/** A rate-item type as staff read it ("Room rate"). */
export function rateItemTypeLabel(type: HotelRateItemType): string {
  return RATE_ITEM_TYPE_LABEL[type];
}
