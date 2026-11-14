import { GlassPanel, Input, Row } from "@ampm/ui";

import { HOTEL_FILTER_FIELDS, HotelFilterSelect, type HotelFilterBarProps } from "./hotel-filters";

export interface HotelSearchPillProps extends HotelFilterBarProps {
  /** The hotel-name search. */
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
}

/**
 * D5's search pill, from 1024: one base-glass pill across the page holding the name search and the three
 * refinement selects side by side in equal shares. The fields keep their own labels and frames (flat
 * tints inside the glass); the search applies as it is typed and chosen, so there is no Search button.
 * The inset keeps each field's label clear of the pill's rounded ends.
 *
 *   <HotelSearchPill query={q} onQueryChange={setQ} value={filters} onChange={setFilters} />
 */
export function HotelSearchPill({ query, onQueryChange, value, onChange }: HotelSearchPillProps) {
  return (
    <GlassPanel className="rounded-full px-7 pb-3.5 pt-3" testID="hotel-search-pill">
      <Row gap={3} align="end">
        <Input
          label="Search hotels"
          leadingIcon="search"
          placeholder="Hotel name"
          value={query}
          onChangeText={onQueryChange}
          returnKeyType="search"
          className="min-w-0 flex-1"
        />
        {HOTEL_FILTER_FIELDS.map((field) => (
          <HotelFilterSelect
            key={field.testID}
            field={field}
            value={value}
            onChange={onChange}
            size="lg"
          />
        ))}
      </Row>
    </GlassPanel>
  );
}
