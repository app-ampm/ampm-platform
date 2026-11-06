import { useLocalSearchParams } from "expo-router";

import { LeadDetailScreen } from "@/features/sales/lead-detail-screen";

export default function LeadRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <LeadDetailScreen leadId={id} />;
}
