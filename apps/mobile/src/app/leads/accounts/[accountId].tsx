import { useLocalSearchParams } from "expo-router";

import { AccountDetailScreen } from "@/features/accounts/account-detail-screen";
import { AppTabBar } from "@/navigation/app-tab-bar";

export default function AccountDetailRoute() {
  const { accountId } = useLocalSearchParams<{ accountId: string }>();
  return <AccountDetailScreen accountId={accountId} tabBar={<AppTabBar />} />;
}
