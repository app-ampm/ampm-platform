import { useLocalSearchParams } from "expo-router";

import { HotelDetailScreen } from "@/features/hotels/hotel-detail-screen";

export default function HotelRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <HotelDetailScreen hotelId={id} />;
}
