import type { HotelView, SavedHotelView } from "@ampm/core";
import { ListItem, PhotoPlaceholder, StatusChip } from "@ampm/ui";

import { MediaImage } from "@/components/media-image";

import { capacityRangeLabel, destinationLabel, starLabel } from "../hotels/hotels.format";

/** P2's 48 × 40 thumbnail on a phone, D4's 56 × 44 from 1024. */
const THUMB = "h-10 w-12 rounded-sm lg:h-11 lg:w-14";

/** "Udaipur · Seats 400–1100": the place and, when known, how many it seats (D4's place line). */
function placeLine(hotel: HotelView): string {
  const seats = hotel.summary.capacity ? capacityRangeLabel(hotel.summary.capacity) : null;
  return [hotel.destination.name, seats].filter(Boolean).join(" · ");
}

function Thumbnail({ hotel }: { readonly hotel: HotelView }) {
  return hotel.coverUrl ? (
    <MediaImage
      uri={hotel.coverUrl}
      alt={`Photo of ${hotel.name}`}
      radius="none"
      className={THUMB}
    />
  ) : (
    <PhotoPlaceholder
      label={`Hotel photo · ${hotel.destination.name}`}
      showLabel={false}
      className={THUMB}
    />
  );
}

export interface SavedCompactRowProps {
  readonly item: SavedHotelView;
  readonly onOpen: () => void;
}

/**
 * One saved hotel in the home's "My selection" panel (P2, D4): a row under a hairline with its photo,
 * name, place and star category, opening the hotel. The shortlist carries no availability or request
 * status per hotel, so the chip is the star category, as on the full shortlist's rows (D7).
 */
export function SavedCompactRow({ item, onOpen }: SavedCompactRowProps) {
  const { hotel } = item;
  return (
    <ListItem
      tone="plain"
      title={hotel.name}
      subtitle={placeLine(hotel)}
      leading={<Thumbnail hotel={hotel} />}
      trailing={
        hotel.starCategory ? (
          <StatusChip label={starLabel(hotel.starCategory)} tone="brand" size="sm" />
        ) : undefined
      }
      accessibilityLabel={`${hotel.name} in ${destinationLabel(hotel.destination)}`}
      onPress={onOpen}
      testID={`saved-row-${hotel.id}`}
    />
  );
}
