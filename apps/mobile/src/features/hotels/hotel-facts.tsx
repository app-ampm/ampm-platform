import type { HotelDetailView } from "@ampm/core";
import { Row, StatusChip } from "@ampm/ui";

import { roomsLabel, starLabel } from "./hotels.format";
import { desktopFacts } from "./hotels.format.desktop";

export interface HotelFactsProps {
  readonly hotel: HotelDetailView;
  /** Adds D6's desktop facts after the size: the venue count and the seating range across them. */
  readonly detailed?: boolean | undefined;
}

/**
 * The facts under the hotel's name as chips: the star category (a highlight) and the size (a plain
 * fact), as P4 draws them; on a desktop also the venues and their seating (D6). Nothing when unknown.
 */
export function HotelFacts({ hotel, detailed = false }: HotelFactsProps) {
  const extra = detailed ? desktopFacts(hotel) : [];
  if (!hotel.starCategory && hotel.totalRooms === null && extra.length === 0) return null;
  return (
    <Row gap={2} wrap>
      {hotel.starCategory ? (
        <StatusChip label={starLabel(hotel.starCategory)} tone="brand" size="sm" icon="star" />
      ) : null}
      {hotel.totalRooms === null ? null : (
        <StatusChip label={roomsLabel(hotel.totalRooms)} tone="info" size="sm" />
      )}
      {extra.map((fact) => (
        <StatusChip key={fact} label={fact} tone="info" size="sm" />
      ))}
    </Row>
  );
}
