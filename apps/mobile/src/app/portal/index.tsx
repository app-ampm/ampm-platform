import { PortalScreen } from "@/features/portal/portal-screen";
import { AppTabBar } from "@/navigation/app-tab-bar";

export default function PortalRoute() {
  return <PortalScreen tabBar={<AppTabBar />} />;
}
