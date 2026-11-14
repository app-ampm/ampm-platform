import type { ReactNode } from "react";
import { ScrollView } from "react-native";

import type { HotelDestinationView } from "@ampm/core";
import { FilterChip } from "@ampm/ui";

export interface DestinationFilterProps {
  /** The destinations to offer (`destinationOptions`): those on screen plus the chosen one. */
  readonly options: readonly HotelDestinationView[];
  readonly selected: HotelDestinationView | null;
  readonly onChange: (destination: HotelDestinationView | null) => void;
  /** Chips that lead the row and scroll with it: the phone's Filters pill, the verified-rates chip. */
  readonly leading?: ReactNode;
}

/**
 * The search's filter chips (D5, P3), for the one discovery filter `useHotels` sends: the
 * destination. Tapping a chip narrows the results to it, tapping it again clears it. A single
 * destination that is not chosen would filter nothing, so its chip stays out until there are two;
 * without leading chips the row then stays hidden.
 */
export function DestinationFilter({
  options,
  selected,
  onChange,
  leading,
}: DestinationFilterProps) {
  const offersDestinations = selected !== null || options.length >= 2;
  if (!offersDestinations && !leading) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      accessibilityLabel={leading ? "Search filters" : "Destinations"}
      // The chips' 46 targets around their 38 pills clip at a horizontal scroll's edges without this.
      contentContainerClassName="gap-2 py-1"
    >
      {leading}
      {offersDestinations
        ? options.map((option) => {
            const isSelected = option.id === selected?.id;
            return (
              <FilterChip
                key={option.id}
                label={option.name}
                icon="map-pin"
                selected={isSelected}
                onPress={() => onChange(isSelected ? null : option)}
              />
            );
          })
        : null}
    </ScrollView>
  );
}
