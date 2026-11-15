import { useLocalSearchParams } from "expo-router";

import { StaffEnquiriesListScreen } from "@/features/consultancy-admin/enquiries-list-screen";
import { parseQueueStage } from "@/features/consultancy-admin/queue-stage";
import { AppTabBar } from "@/navigation/app-tab-bar";

export default function StaffEnquiriesRoute() {
  const { stage } = useLocalSearchParams<{ stage?: string }>();
  return <StaffEnquiriesListScreen tabBar={<AppTabBar />} stage={parseQueueStage(stage)} />;
}
