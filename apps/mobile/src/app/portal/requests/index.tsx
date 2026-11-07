import { RequestsListScreen } from "@/features/consultancy/requests-list-screen";
import { AppTabBar } from "@/navigation/app-tab-bar";

export default function RequestsRoute() {
  return <RequestsListScreen tabBar={<AppTabBar />} />;
}
