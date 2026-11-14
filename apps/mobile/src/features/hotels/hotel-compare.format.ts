import {
  formatAmount,
  formatDay,
  type ClientRateItemView,
  type HotelCompareItem,
  type HotelRateFreshness,
  type HotelRateItemType,
  type HotelRatesView,
} from "@ampm/core";

import {
  capacityRangeLabel,
  destinationLabel,
  hasRateAmounts,
  percentLabel,
  rateAmounts,
  rateFreshnessChip,
  rateItemLabel,
  rateUnitLabel,
  roomsLabel,
  type RateChip,
} from "./hotels.format";

/**
 * One row of the side by side (D7): a plain value, one rate type's indicative amounts, or the rates'
 * freshness chip. `label` heads the row and names the field in every cell's spoken label.
 */
export type CompareAttr =
  | {
      readonly kind: "text";
      readonly key: string;
      readonly label: string;
      readonly text: (item: HotelCompareItem) => string;
    }
  | {
      readonly kind: "rate";
      readonly key: string;
      readonly label: string;
      readonly type: HotelRateItemType;
    }
  | { readonly kind: "freshness"; readonly key: string; readonly label: string };

/** The rate rows a planner weighs, in D7's order (room, then catering, then the package and charges). */
const RATE_ROWS: readonly HotelRateItemType[] = [
  "room_rate",
  "venue_rental",
  "per_plate_veg",
  "per_plate_non_veg",
  "wedding_package",
  "beverage_package",
  "service_charge",
  "tax",
];

const EM_DASH = "—";

/**
 * A rate type's indicative range across the hotel's items of that type (a hotel may price several room
 * categories): the lowest amount to the highest upper bound, among the items quoted in the first one's
 * unit so units never mix. Null when the rates show no amounts (on request, AC-04) or carry no such item.
 */
export function rateForType(
  rates: HotelRatesView,
  type: HotelRateItemType,
): ClientRateItemView | null {
  if (!hasRateAmounts(rates)) return null;
  const first = rates.items.find((item) => item.itemType === type);
  if (!first) return null;
  const same = rates.items.filter((item) => item.itemType === type && item.unit === first.unit);
  const low = Math.min(...same.map((item) => item.amount.minor));
  const high = Math.max(...same.map((item) => (item.amountMax ?? item.amount).minor));
  return {
    ...first,
    amount: { ...first.amount, minor: low },
    amountMax: high > low ? { ...first.amount, minor: high } : null,
  };
}

/** A rate as one line of text with its unit: "₹22,000–₹32,000 per night", "18% on the total". */
export function rateValueText(item: ClientRateItemView): string {
  if (item.unit === "percent") return `${percentLabel(item)} ${rateUnitLabel(item.unit)}`;
  const { amount, amountMax } = rateAmounts(item);
  const money = amountMax
    ? `${formatAmount(amount)}–${formatAmount(amountMax)}`
    : formatAmount(amount);
  return `${money} ${rateUnitLabel(item.unit)}`;
}

/**
 * The compare cell's freshness chip: D7's short "Verified 2 Nov 2026" (a column has no room for the
 * detail's full sentence, which the cell still speaks); stale and on request read as on the detail.
 */
export function compareFreshnessChip(rates: HotelRatesView): RateChip {
  return shortFreshnessChip(rates.status, rates.asOf);
}

/** The same short chip from a freshness and its day alone, as a shortlist entry's card summary carries them. */
export function shortFreshnessChip(status: HotelRateFreshness, asOf: string | null): RateChip {
  if (status === "verified" && asOf)
    return { label: `Verified ${formatDay(asOf)}`, tone: "success", dot: true };
  // The detail's wording reads only the state and the day, so no items are needed to ask for it.
  return rateFreshnessChip({ status, asOf, items: [] });
}

/** A rate row's heading: the room rate reads "Room rate", every other type its rate-card label. */
function rateRowLabel(type: HotelRateItemType): string {
  return type === "room_rate" ? "Room rate" : rateItemLabel(type);
}

/**
 * The rows for these hotels (D7): where each is, its seating and rooms, then a row per rate type at least
 * one of them prices, then the rates' freshness. A row no hotel has data for is left out rather than shown
 * empty (no hotel's venue count, late licence or availability reaches the client yet).
 */
export function compareAttrs(items: readonly HotelCompareItem[]): CompareAttr[] {
  const seats = items.some((item) => item.summary.capacity !== null);
  const rooms = items.some((item) => item.totalRooms != null);
  const priced = RATE_ROWS.filter((type) =>
    items.some((item) => rateForType(item.rates, type) !== null),
  );
  const attrs: CompareAttr[] = [
    {
      kind: "text",
      key: "destination",
      label: "Destination",
      text: (item) => destinationLabel(item.destination),
    },
  ];
  if (seats)
    attrs.push({
      kind: "text",
      key: "capacity",
      label: "Capacity",
      text: (item) => (item.summary.capacity ? capacityRangeLabel(item.summary.capacity) : EM_DASH),
    });
  if (rooms)
    attrs.push({
      kind: "text",
      key: "rooms",
      label: "Rooms",
      text: (item) => (item.totalRooms != null ? roomsLabel(item.totalRooms) : EM_DASH),
    });
  for (const type of priced)
    attrs.push({ kind: "rate", key: type, label: rateRowLabel(type), type });
  attrs.push({ kind: "freshness", key: "rates", label: "Rates" });
  return attrs;
}

/** A cell's value as words, for its spoken label and as the plain text a text row shows. */
export function compareCellText(attr: CompareAttr, item: HotelCompareItem): string {
  if (attr.kind === "text") return attr.text(item);
  if (attr.kind === "freshness") return rateFreshnessChip(item.rates).label;
  if (!hasRateAmounts(item.rates)) return "On request";
  const rate = rateForType(item.rates, attr.type);
  return rate ? rateValueText(rate) : EM_DASH;
}
