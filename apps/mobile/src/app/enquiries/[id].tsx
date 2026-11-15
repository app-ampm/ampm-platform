import { useLocalSearchParams } from "expo-router";

import { StaffEnquiryDetailScreen } from "@/features/consultancy-admin/enquiry-detail-screen";
import { parseQueueAssignee, parseQueueStage } from "@/features/consultancy-admin/queue-filter";

export default function StaffEnquiryDetailRoute() {
  const { id, stage, assignee } = useLocalSearchParams<{
    id: string;
    stage?: string;
    assignee?: string;
  }>();
  return (
    <StaffEnquiryDetailScreen
      enquiryId={id}
      stage={parseQueueStage(stage)}
      assignee={parseQueueAssignee(assignee)}
    />
  );
}
