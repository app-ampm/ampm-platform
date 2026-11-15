import { FinanceScreen } from "@/features/finance/finance-screen";
import { AppTabBar } from "@/navigation/app-tab-bar";

export default function FinanceRoute() {
  return <FinanceScreen tabBar={<AppTabBar />} />;
}
