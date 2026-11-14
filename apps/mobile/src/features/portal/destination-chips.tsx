import { ScrollView } from "react-native";
import { useRouter } from "expo-router";

import { useDestinations } from "@ampm/api-client";
import { FilterChip, Stack, Text } from "@ampm/ui";

/**
 * The destinations the subscriber can reach as navigational chips on the home (CP-01, B16): each opens that
 * destination's hotels (/hotels/destinations/[id], the B8 browse detail), the hotel count on the chip. A
 * bounded reference set — the row shows only once at least one destination is loaded, nothing while it loads
 * or when the account reaches none, so it never leaves an empty heading on the home.
 */
export function DestinationChips() {
  const router = useRouter();
  const destinations = useDestinations();
  const items = destinations.data?.items ?? [];
  if (items.length === 0) return null;
  return (
    <Stack gap={2}>
      <Text variant="subheading">Explore destinations</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        accessibilityLabel="Destinations"
        // The chips' 46 targets around their 38 pills clip at a horizontal scroll's edges without this.
        contentContainerClassName="gap-2 py-1"
      >
        {items.map((item) => (
          <FilterChip
            key={item.id}
            label={item.name}
            icon="map-pin"
            count={item.hotelCount}
            onPress={() =>
              router.push({
                pathname: "/hotels/destinations/[id]",
                params: { id: item.id, name: item.name },
              })
            }
          />
        ))}
      </ScrollView>
    </Stack>
  );
}
