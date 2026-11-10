import { AccountsListScreen } from "@/features/accounts/accounts-list-screen";
import { AppTabBar } from "@/navigation/app-tab-bar";

export default function AccountsRoute() {
  return <AccountsListScreen tabBar={<AppTabBar />} />;
}
