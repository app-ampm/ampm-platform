import { LeadsListScreen } from "@/features/sales/leads-list-screen";
import { AppTabBar } from "@/navigation/app-tab-bar";

export default function LeadsRoute() {
  return <LeadsListScreen tabBar={<AppTabBar />} />;
}
