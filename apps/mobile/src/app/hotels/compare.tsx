import { useLocalSearchParams } from "expo-router";

import { CompareScreen } from "@/features/hotels/compare-screen";
import { parseCompareIds } from "@/features/hotels/hotels.format";

export default function CompareRoute() {
  const { ids } = useLocalSearchParams<{ ids?: string | string[] }>();
  return <CompareScreen ids={parseCompareIds(ids)} />;
}
