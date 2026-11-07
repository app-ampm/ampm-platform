import { SavedHotelsScreen } from "@/features/hotels/saved-hotels-screen";
import { AppTabBar } from "@/navigation/app-tab-bar";

export default function SavedHotelsRoute() {
  return <SavedHotelsScreen tabBar={<AppTabBar />} />;
}
