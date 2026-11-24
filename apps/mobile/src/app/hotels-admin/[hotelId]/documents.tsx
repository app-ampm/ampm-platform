import { useLocalSearchParams } from "expo-router";

import { HotelDocumentsScreen } from "@/features/hotels-admin/hotel-documents-screen";
import { AppTabBar } from "@/navigation/app-tab-bar";

export default function HotelDocumentsRoute() {
  const { hotelId } = useLocalSearchParams<{ hotelId: string }>();
  return <HotelDocumentsScreen hotelId={hotelId} tabBar={<AppTabBar />} />;
}
