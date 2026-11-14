import { Card, ScreenHeader, cn } from "@ampm/ui";

import { HotelSearchEntry } from "./hotel-search-entry";
import { greeting } from "./portal.format";

export interface HomeSearchCardProps {
  readonly name: string;
  readonly className?: string | undefined;
}

/**
 * D4's first panel on a desktop: the greeting and the page's title on base glass above the search pill
 * (padding 32 × 36, 22 between them). The title is the page's heading; the top navigation carries the
 * client's avatar, so the header has none. A phone keeps P2's header over a bare pill instead.
 */
export function HomeSearchCard({ name, className }: HomeSearchCardProps) {
  return (
    <Card className={cn("gap-5.5 lg:px-9 lg:py-8", className)} testID="home-search-card">
      <ScreenHeader eyebrow={greeting(name)} title="Where shall we look today?" />
      <HotelSearchEntry nested />
    </Card>
  );
}
