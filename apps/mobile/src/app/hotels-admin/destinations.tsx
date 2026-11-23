import { DestinationsScreen } from "@/features/hotels-admin/destinations-screen";
import { AppTabBar } from "@/navigation/app-tab-bar";

export default function DestinationsRoute() {
  return <DestinationsScreen tabBar={<AppTabBar />} />;
}
