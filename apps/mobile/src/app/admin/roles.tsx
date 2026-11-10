import { RolesScreen } from "@/features/admin/roles-screen";
import { AppTabBar } from "@/navigation/app-tab-bar";

export default function RolesRoute() {
  return <RolesScreen tabBar={<AppTabBar />} />;
}
