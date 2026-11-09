import { ConfigurationScreen } from "@/features/admin/configuration-screen";
import { AppTabBar } from "@/navigation/app-tab-bar";

export default function ConfigurationRoute() {
  return <ConfigurationScreen tabBar={<AppTabBar />} />;
}
