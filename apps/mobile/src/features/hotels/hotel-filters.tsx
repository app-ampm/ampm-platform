import { FilterChip, Row, Select, Stack, type SelectOption } from "@ampm/ui";

import type { HotelFilters } from "./hotels.format";

/** Star-rating options; "any" clears the filter. Hotels carry "3"/"4"/"5" (CP-04). */
const STAR_OPTIONS: readonly SelectOption<string>[] = [
  { value: "any", label: "Any rating" },
  { value: "5", label: "5-star" },
  { value: "4", label: "4-star" },
  { value: "3", label: "3-star" },
];

/** Minimum event capacity — a venue (banquet or reception) that seats at least this many (CP-04). */
const CAPACITY_OPTIONS: readonly SelectOption<string>[] = [
  { value: "any", label: "Any capacity" },
  { value: "200", label: "200+ guests" },
  { value: "500", label: "500+ guests" },
  { value: "1000", label: "1,000+ guests" },
];

/** Minimum hotel size — total rooms (accommodation) (CP-04). */
const ROOMS_OPTIONS: readonly SelectOption<string>[] = [
  { value: "any", label: "Any size" },
  { value: "50", label: "50+ rooms" },
  { value: "100", label: "100+ rooms" },
  { value: "150", label: "150+ rooms" },
];

/** A Select value back to a filter minimum: "any" clears it, else the parsed count. */
function toMinimum(value: string): number | undefined {
  return value === "any" ? undefined : Number(value);
}

export interface HotelFilterBarProps {
  readonly value: HotelFilters;
  readonly onChange: (next: HotelFilters) => void;
}

/**
 * The discovery refinement filters (CP-04, feature 9.4): star rating, event capacity, hotel size and
 * verified-rates-only, live-applied over the destination/name search. Each Select's "any" row clears its
 * filter; the chip toggles verified pricing. The backend still narrows within the account's reach.
 *
 *   <HotelFilterBar value={filters} onChange={setFilters} />
 */
export function HotelFilterBar({ value, onChange }: HotelFilterBarProps) {
  return (
    <Stack gap={2}>
      <Row gap={2} wrap>
        <Select
          label="Star rating"
          value={value.star ?? "any"}
          options={STAR_OPTIONS}
          onChange={(next) => onChange({ ...value, star: next === "any" ? undefined : next })}
          testID="hotel-filter-star"
          className="min-w-0 flex-1"
        />
        <Select
          label="Guest capacity"
          value={value.minGuestCapacity != null ? String(value.minGuestCapacity) : "any"}
          options={CAPACITY_OPTIONS}
          onChange={(next) => onChange({ ...value, minGuestCapacity: toMinimum(next) })}
          testID="hotel-filter-capacity"
          className="min-w-0 flex-1"
        />
        <Select
          label="Hotel size"
          value={value.minRooms != null ? String(value.minRooms) : "any"}
          options={ROOMS_OPTIONS}
          onChange={(next) => onChange({ ...value, minRooms: toMinimum(next) })}
          testID="hotel-filter-rooms"
          className="min-w-0 flex-1"
        />
      </Row>
      <FilterChip
        label="Verified rates only"
        icon="shield-check"
        selected={value.verifiedRatesOnly ?? false}
        onPress={() =>
          onChange({ ...value, verifiedRatesOnly: value.verifiedRatesOnly ? undefined : true })
        }
      />
    </Stack>
  );
}
