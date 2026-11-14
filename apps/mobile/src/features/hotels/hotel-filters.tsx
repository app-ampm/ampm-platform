import { FilterChip, Row, Select, Stack, type InputSize, type SelectOption } from "@ampm/ui";

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

/** A choice back to a filter minimum: "any" clears it, else the parsed count. */
function toMinimum(value: string): number | undefined {
  return value === "any" ? undefined : Number(value);
}

/** A minimum back to its choice: unset is "any". */
function fromMinimum(value: number | undefined): string {
  return value != null ? String(value) : "any";
}

/**
 * One refinement filter as a single choice: its options, the choice the filters hold, and the filters
 * after a new choice. The tablet and desktop selects and the phone's filter sheet read the same table.
 */
export interface HotelFilterField {
  readonly label: string;
  readonly testID: string;
  readonly options: readonly SelectOption<string>[];
  readonly valueOf: (filters: HotelFilters) => string;
  readonly apply: (filters: HotelFilters, next: string) => HotelFilters;
}

export const HOTEL_FILTER_FIELDS: readonly HotelFilterField[] = [
  {
    label: "Star rating",
    testID: "hotel-filter-star",
    options: STAR_OPTIONS,
    valueOf: (filters) => filters.star ?? "any",
    apply: (filters, next) => ({ ...filters, star: next === "any" ? undefined : next }),
  },
  {
    label: "Guest capacity",
    testID: "hotel-filter-capacity",
    options: CAPACITY_OPTIONS,
    valueOf: (filters) => fromMinimum(filters.minGuestCapacity),
    apply: (filters, next) => ({ ...filters, minGuestCapacity: toMinimum(next) }),
  },
  {
    label: "Hotel size",
    testID: "hotel-filter-rooms",
    options: ROOMS_OPTIONS,
    valueOf: (filters) => fromMinimum(filters.minRooms),
    apply: (filters, next) => ({ ...filters, minRooms: toMinimum(next) }),
  },
];

export interface HotelFilterBarProps {
  readonly value: HotelFilters;
  readonly onChange: (next: HotelFilters) => void;
}

interface HotelFilterSelectProps extends HotelFilterBarProps {
  readonly field: HotelFilterField;
  /** `lg` beside the name search in the desktop pill, whose text field stands taller than a select. */
  readonly size?: InputSize | undefined;
}

/** One refinement filter as a Select that shares its row: "any" clears it. */
export function HotelFilterSelect({ field, value, onChange, size }: HotelFilterSelectProps) {
  return (
    <Select
      label={field.label}
      value={field.valueOf(value)}
      options={field.options}
      onChange={(next) => onChange(field.apply(value, next))}
      size={size}
      testID={field.testID}
      className="min-w-0 flex-1"
    />
  );
}

/** The verified-pricing toggle: a chip, on the phone's chip row, the tablet's filter stack and D5's chip row. */
export function VerifiedRatesChip({ value, onChange }: HotelFilterBarProps) {
  return (
    <FilterChip
      label="Verified rates only"
      icon="shield-check"
      selected={value.verifiedRatesOnly ?? false}
      onPress={() =>
        onChange({ ...value, verifiedRatesOnly: value.verifiedRatesOnly ? undefined : true })
      }
    />
  );
}

/**
 * The discovery refinement filters on a tablet (CP-04, feature 9.4): star rating, event capacity, hotel
 * size and verified-rates-only, live-applied over the destination/name search. Each Select's "any" row
 * clears its filter; the chip toggles verified pricing. The backend still narrows within the account's
 * reach. A phone puts the selects behind `HotelFiltersButton`; a desktop puts them in `HotelSearchPill`.
 *
 *   <HotelFilterBar value={filters} onChange={setFilters} />
 */
export function HotelFilterBar({ value, onChange }: HotelFilterBarProps) {
  return (
    <Stack gap={2}>
      <Row gap={2} wrap>
        {HOTEL_FILTER_FIELDS.map((field) => (
          <HotelFilterSelect key={field.testID} field={field} value={value} onChange={onChange} />
        ))}
      </Row>
      <VerifiedRatesChip value={value} onChange={onChange} />
    </Stack>
  );
}
