import { useLocalSearchParams } from "expo-router";

import { RequestDetailScreen } from "@/features/consultancy/request-detail-screen";

export default function RequestDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RequestDetailScreen enquiryId={id} />;
}
