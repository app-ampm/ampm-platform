import { NotificationsLogScreen } from "@/features/admin/notifications-log-screen";
import { AppTabBar } from "@/navigation/app-tab-bar";

export default function NotificationsLogRoute() {
  return <NotificationsLogScreen tabBar={<AppTabBar />} />;
}
