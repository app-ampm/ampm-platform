import { useRouter } from "expo-router";

import { Button, GlassPanel, Icon, Text, cn } from "@ampm/ui";

export interface HotelSearchEntryProps {
  /** Inside another glass panel (D4's search card): a flat tint, since only top-level panels blur. */
  readonly nested?: boolean | undefined;
  readonly className?: string | undefined;
}

/**
 * The search pill of the subscriber home (P2, D4): base glass with the gold "Search" that opens hotel
 * discovery, the home's one gold action. The wedding's place, dates and guests the mocks show are not
 * in the data yet, so the pill names the search instead.
 */
export function HotelSearchEntry({ nested = false, className }: HotelSearchEntryProps) {
  const router = useRouter();
  return (
    <GlassPanel
      blur={!nested}
      className={cn("flex-row items-center gap-3 rounded-full p-1.5 pl-4", className)}
    >
      <Icon name="search" tone="muted" />
      <Text weight="semibold" tone="primary" numberOfLines={1} className="flex-1">
        Search all hotels
      </Text>
      <Button accessibilityLabel="Search hotels" onPress={() => router.push("/hotels")}>
        Search
      </Button>
    </GlassPanel>
  );
}
