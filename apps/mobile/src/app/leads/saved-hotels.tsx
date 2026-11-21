import { ClientSavedHotelsScreen } from "@/features/accounts/client-saved-hotels-screen";
import { AppTabBar } from "@/navigation/app-tab-bar";

export default function ClientSavedHotelsRoute() {
  return <ClientSavedHotelsScreen tabBar={<AppTabBar />} />;
}
