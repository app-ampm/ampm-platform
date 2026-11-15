import { useLocalSearchParams } from "expo-router";

import { StaffEnquiryDetailScreen } from "@/features/consultancy-admin/enquiry-detail-screen";
import { parseQueueStage } from "@/features/consultancy-admin/queue-stage";

export default function StaffEnquiryDetailRoute() {
  const { id, stage } = useLocalSearchParams<{ id: string; stage?: string }>();
  return <StaffEnquiryDetailScreen enquiryId={id} stage={parseQueueStage(stage)} />;
}
