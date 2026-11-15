import { useLocalSearchParams } from "expo-router";

import { StaffEnquiriesListScreen } from "@/features/consultancy-admin/enquiries-list-screen";
import { parseQueueAssignee, parseQueueStage } from "@/features/consultancy-admin/queue-filter";
import { AppTabBar } from "@/navigation/app-tab-bar";

export default function StaffEnquiriesRoute() {
  const { stage, assignee } = useLocalSearchParams<{ stage?: string; assignee?: string }>();
  return (
    <StaffEnquiriesListScreen
      tabBar={<AppTabBar />}
      stage={parseQueueStage(stage)}
      assignee={parseQueueAssignee(assignee)}
    />
  );
}
