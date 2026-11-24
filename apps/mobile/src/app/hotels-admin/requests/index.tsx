import { InfoRequestsScreen } from "@/features/hotel-info-requests/info-requests-screen";
import { AppTabBar } from "@/navigation/app-tab-bar";

export default function InfoRequestsRoute() {
  return <InfoRequestsScreen tabBar={<AppTabBar />} />;
}
