import { ScrollView } from "react-native";

import type { HotelDestinationView } from "@ampm/core";
import { FilterChip } from "@ampm/ui";

export interface DestinationFilterProps {
  /** The destinations to offer (`destinationOptions`): those on screen plus the chosen one. */
  readonly options: readonly HotelDestinationView[];
  readonly selected: HotelDestinationView | null;
  readonly onChange: (destination: HotelDestinationView | null) => void;
}

/**
 * The search's filter chips (D5, P3), for the one discovery filter `useHotels` sends: the
 * destination. Tapping a chip narrows the results to it, tapping it again clears it. A single
 * destination that is not chosen would filter nothing, so the row stays hidden until there are two.
 */
export function DestinationFilter({ options, selected, onChange }: DestinationFilterProps) {
  if (selected === null && options.length < 2) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      accessibilityLabel="Destinations"
      // The chips' 46 targets around their 38 pills clip at a horizontal scroll's edges without this.
      contentContainerClassName="gap-2 py-1"
    >
      {options.map((option) => {
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
      })}
    </ScrollView>
  );
}
