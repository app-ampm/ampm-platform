import { StaffUsersScreen } from "@/features/admin/staff-users-screen";
import { AppTabBar } from "@/navigation/app-tab-bar";

export default function StaffUsersRoute() {
  return <StaffUsersScreen tabBar={<AppTabBar />} />;
}
