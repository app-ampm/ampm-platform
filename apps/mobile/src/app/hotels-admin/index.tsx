import { HotelsListScreen } from "@/features/hotels-admin/hotels-list-screen";
import { AppTabBar } from "@/navigation/app-tab-bar";

export default function HotelsListRoute() {
  return <HotelsListScreen tabBar={<AppTabBar />} />;
}
