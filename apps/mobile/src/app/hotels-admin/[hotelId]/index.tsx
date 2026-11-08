import { useLocalSearchParams } from "expo-router";

import { HotelMediaScreen } from "@/features/hotels-admin/hotel-media-screen";
import { AppTabBar } from "@/navigation/app-tab-bar";

export default function HotelMediaRoute() {
  const { hotelId } = useLocalSearchParams<{ hotelId: string }>();
  return <HotelMediaScreen hotelId={hotelId} tabBar={<AppTabBar />} />;
}
