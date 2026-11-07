import { StaffEnquiriesListScreen } from "@/features/consultancy-admin/enquiries-list-screen";
import { AppTabBar } from "@/navigation/app-tab-bar";

export default function StaffEnquiriesRoute() {
  return <StaffEnquiriesListScreen tabBar={<AppTabBar />} />;
}
