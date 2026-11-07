import { AdminConsoleScreen } from "@/features/admin/admin-console-screen";
import { AppTabBar } from "@/navigation/app-tab-bar";

export default function AdminRoute() {
  return <AdminConsoleScreen tabBar={<AppTabBar />} />;
}
