import { AuditLogScreen } from "@/features/admin/audit-log-screen";
import { AppTabBar } from "@/navigation/app-tab-bar";

export default function AuditLogRoute() {
  return <AuditLogScreen tabBar={<AppTabBar />} />;
}
