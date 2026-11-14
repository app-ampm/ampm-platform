import { useState } from "react";

import { Button, FilterChip, Row, Sheet, Stack, Text } from "@ampm/ui";

import {
  HOTEL_FILTER_FIELDS,
  type HotelFilterBarProps,
  type HotelFilterField,
} from "./hotel-filters";
import type { HotelFilters } from "./hotels.format";

/** How many of the sheet's filters are set; verified pricing keeps its own chip on the row. */
function sheetFilterCount(filters: HotelFilters): number {
  return HOTEL_FILTER_FIELDS.filter((field) => field.valueOf(filters) !== "any").length;
}

/** No sheet filter set: what "Clear" leaves, keeping the verified-pricing chip as it is. */
function withoutSheetFilters(filters: HotelFilters): HotelFilters {
  return HOTEL_FILTER_FIELDS.reduce((next, field) => field.apply(next, "any"), filters);
}

interface FilterChoiceRowProps extends HotelFilterBarProps {
  readonly field: HotelFilterField;
}

/** One filter as a labelled row of single-choice chips; the chosen one carries a check, never colour alone. */
function FilterChoiceRow({ field, value, onChange }: FilterChoiceRowProps) {
  const chosen = field.valueOf(value);
  return (
    <Stack gap={2}>
      <Text variant="label" tone="body">
        {field.label}
      </Text>
      <Row gap={2} wrap testID={`${field.testID}-choices`}>
        {field.options.map((option) => (
          <FilterChip
            key={option.value}
            label={option.label}
            selected={option.value === chosen}
            icon={option.value === chosen ? "check" : undefined}
            onPress={() => onChange(field.apply(value, option.value))}
            testID={`${field.testID}-option-${option.value}`}
          />
        ))}
      </Row>
    </Stack>
  );
}

interface HotelFilterSheetProps extends HotelFilterBarProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

/** The filters live-apply as they are chosen, so the sheet's action only closes it over the results. */
function HotelFilterSheet({ open, onClose, value, onChange }: HotelFilterSheetProps) {
  const count = sheetFilterCount(value);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Filters"
      testID="hotel-filter-sheet"
      footer={
        <Row gap={2}>
          {count > 0 ? (
            <Button variant="secondary" onPress={() => onChange(withoutSheetFilters(value))}>
              Clear
            </Button>
          ) : null}
          <Button onPress={onClose} className="flex-1" testID="hotel-filter-sheet-done">
            Show hotels
          </Button>
        </Row>
      }
    >
      <Stack gap={4}>
        {HOTEL_FILTER_FIELDS.map((field) => (
          <FilterChoiceRow key={field.testID} field={field} value={value} onChange={onChange} />
        ))}
      </Stack>
    </Sheet>
  );
}

/**
 * P3's "Filters · n" pill and the sheet it opens, for a phone. Three selects sharing a phone's row get
 * about 112 each and truncate every value to "Any …"; wrapping them would stack three labelled fields
 * above the results. The sheet gives each filter the full width as a row of chips and keeps the results
 * in reach, as P3 draws it. The count names the sheet's filters that are set.
 *
 *   <HotelFiltersButton value={filters} onChange={setFilters} />
 */
export function HotelFiltersButton({ value, onChange }: HotelFilterBarProps) {
  const [open, setOpen] = useState(false);
  const count = sheetFilterCount(value);
  return (
    <>
      <FilterChip
        label="Filters"
        icon="sliders"
        count={count > 0 ? count : undefined}
        onPress={() => setOpen(true)}
        testID="hotel-filters-button"
      />
      <HotelFilterSheet
        open={open}
        onClose={() => setOpen(false)}
        value={value}
        onChange={onChange}
      />
    </>
  );
}
