import { useRouter } from "expo-router";

import { useHotels } from "@ampm/api-client";
import { Screen, ScreenHeader } from "@ampm/ui";

import { HotelResults } from "./hotel-results";

export interface DestinationHotelsScreenProps {
  readonly destinationId: string;
  /** The destination's name for the header, passed from the browse card; a deep link may omit it. */
  readonly destinationName?: string | undefined;
}

/**
 * One destination's hotels (CP-03, feature 9.4b): the discovery results scoped to it, reusing the shared
 * hotel-results list (its loading, empty, error and offline states, and its cover/freshness cards).
 */
export function DestinationHotelsScreen({
  destinationId,
  destinationName,
}: DestinationHotelsScreenProps) {
  const router = useRouter();
  const hotels = useHotels({ destinationId });
  return (
    <Screen
      glow="top"
      width="content"
      header={
        <ScreenHeader
          eyebrow="Destination"
          title={destinationName ?? "Hotels"}
          onBack={() => router.back()}
        />
      }
    >
      <HotelResults
        hotels={hotels}
        onOpen={(id) => router.push({ pathname: "/hotels/[id]", params: { id } })}
      />
    </Screen>
  );
}
