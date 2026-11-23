import { useLocalSearchParams } from "expo-router";

import { HotelReferencesScreen } from "@/features/hotels-admin/hotel-references-screen";
import { AppTabBar } from "@/navigation/app-tab-bar";

export default function HotelReferencesRoute() {
  const { hotelId } = useLocalSearchParams<{ hotelId: string }>();
  return <HotelReferencesScreen hotelId={hotelId} tabBar={<AppTabBar />} />;
}
