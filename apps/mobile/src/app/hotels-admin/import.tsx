import { HotelImportScreen } from "@/features/hotels-admin/hotel-import-screen";
import { AppTabBar } from "@/navigation/app-tab-bar";

export default function HotelImportRoute() {
  return <HotelImportScreen tabBar={<AppTabBar />} />;
}
