import type { ClientRateItemView, HotelRateItemType } from "@ampm/core";

/** Which group of the Rates tab a rate item belongs to (B18): accommodation/venue, F&B, or charges. */
const RATE_CATEGORY: Readonly<Record<HotelRateItemType, "stay" | "food" | "charges">> = {
  room_rate: "stay",
  venue_rental: "stay",
  per_plate_veg: "food",
  per_plate_non_veg: "food",
  wedding_package: "food",
  beverage_package: "food",
  service_charge: "charges",
  tax: "charges",
  other: "charges",
};

const RATE_CATEGORIES = [
  { key: "stay", label: "Rooms & venues" },
  { key: "food", label: "Food & beverage" },
  { key: "charges", label: "Charges & taxes" },
] as const;

/** One labelled group of rate items, in display order. */
export interface RateGroup {
  readonly label: string;
  readonly items: readonly ClientRateItemView[];
}

/**
 * The client-visible rate items grouped for the Rates tab (B18): accommodation and venue, then food and
 * beverage, then charges and taxes — so a planner reads the catering apart from the room and venue cost.
 * Order within a group is preserved (the API already orders by type); an empty group is omitted.
 */
export function groupRateItems(items: readonly ClientRateItemView[]): RateGroup[] {
  return RATE_CATEGORIES.flatMap(({ key, label }) => {
    const group = items.filter((item) => RATE_CATEGORY[item.itemType] === key);
    return group.length > 0 ? [{ label, items: group }] : [];
  });
}
