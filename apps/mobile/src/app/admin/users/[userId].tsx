import { useLocalSearchParams } from "expo-router";

import { StaffUserDetailScreen } from "@/features/admin/staff-user-detail-screen";

export default function StaffUserRoute() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  return <StaffUserDetailScreen userId={userId} />;
}
