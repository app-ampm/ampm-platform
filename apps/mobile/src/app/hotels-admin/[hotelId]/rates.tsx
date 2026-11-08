import { useLocalSearchParams } from "expo-router";

import { HotelRatesScreen } from "@/features/hotels-admin/hotel-rates-screen";
import { AppTabBar } from "@/navigation/app-tab-bar";

export default function HotelRatesRoute() {
  const { hotelId } = useLocalSearchParams<{ hotelId: string }>();
  return <HotelRatesScreen hotelId={hotelId} tabBar={<AppTabBar />} />;
}
