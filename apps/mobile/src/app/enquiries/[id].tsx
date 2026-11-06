import { useLocalSearchParams } from "expo-router";

import { StaffEnquiryDetailScreen } from "@/features/consultancy-admin/enquiry-detail-screen";

export default function StaffEnquiryDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <StaffEnquiryDetailScreen enquiryId={id} />;
}
