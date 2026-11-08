import { useLocalSearchParams } from "expo-router";

import { HotelDetailsScreen } from "@/features/hotels-admin/hotel-details-screen";
import { AppTabBar } from "@/navigation/app-tab-bar";

export default function HotelDetailsRoute() {
  const { hotelId } = useLocalSearchParams<{ hotelId: string }>();
  return <HotelDetailsScreen hotelId={hotelId} tabBar={<AppTabBar />} />;
}
