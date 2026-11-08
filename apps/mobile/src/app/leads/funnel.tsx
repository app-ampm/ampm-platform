import { LeadFunnelScreen } from "@/features/sales/lead-funnel-screen";
import { AppTabBar } from "@/navigation/app-tab-bar";

export default function LeadFunnelRoute() {
  return <LeadFunnelScreen tabBar={<AppTabBar />} />;
}
