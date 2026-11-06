import { useLocalSearchParams } from "expo-router";

import { NewRequestScreen } from "@/features/consultancy/new-request-screen";

export default function NewRequestRoute() {
  const { hotelId } = useLocalSearchParams<{ hotelId: string }>();
  return <NewRequestScreen hotelId={hotelId} />;
}
