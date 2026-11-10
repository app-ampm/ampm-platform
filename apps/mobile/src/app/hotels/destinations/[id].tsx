import { useLocalSearchParams } from "expo-router";

import { DestinationHotelsScreen } from "@/features/hotels/destination-hotels-screen";

export default function DestinationRoute() {
  // expo-router returns string | string[] for any param; a repeated ?name= must not reach the header as an array.
  const { id, name } = useLocalSearchParams<{ id: string; name?: string | string[] }>();
  const destinationName = Array.isArray(name) ? name[0] : name;
  return <DestinationHotelsScreen destinationId={id} destinationName={destinationName} />;
}
