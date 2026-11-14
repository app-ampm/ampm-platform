import { HotelDestinationsScreen } from "@/features/hotels/hotel-destinations-screen";
import { AppTabBar } from "@/navigation/app-tab-bar";

export default function DestinationsRoute() {
  return <HotelDestinationsScreen tabBar={<AppTabBar />} />;
}
