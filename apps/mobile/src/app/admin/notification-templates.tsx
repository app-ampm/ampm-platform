import { NotificationTemplatesScreen } from "@/features/admin/notification-templates-screen";
import { AppTabBar } from "@/navigation/app-tab-bar";

export default function NotificationTemplatesRoute() {
  return <NotificationTemplatesScreen tabBar={<AppTabBar />} />;
}
