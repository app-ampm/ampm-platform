import { HotelsScreen } from "@/features/hotels/hotels-screen";
import { AppTabBar } from "@/navigation/app-tab-bar";

export default function HotelsRoute() {
  return <HotelsScreen tabBar={<AppTabBar />} />;
}
