import { AccountScreen } from "@/features/account/account-screen";
import { AppTabBar } from "@/navigation/app-tab-bar";

export default function AccountRoute() {
  return <AccountScreen tabBar={<AppTabBar />} />;
}
