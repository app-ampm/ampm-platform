import type { HotelDetailView } from "@ampm/core";
import { Row, Stack, StatusChip, Text } from "@ampm/ui";

export interface HotelFacilitiesProps {
  readonly hotel: HotelDetailView;
  /** False when a card already titles the chips (the desktop side column's "Facilities" card). */
  readonly showEyebrow?: boolean | undefined;
}

/**
 * The hotel's amenities (B14 / CP-05): the curated hotel facilities, or the amenities drawn from its
 * rooms and venues when none are curated (the API combines the two into one list). Shown as neutral
 * chips, like the facts under the hotel name; omitted when the hotel lists none.
 */
export function HotelFacilities({ hotel, showEyebrow = true }: HotelFacilitiesProps) {
  if (hotel.facilities.length === 0) return null;
  return (
    <Stack gap={2}>
      {showEyebrow ? <Text variant="eyebrow">Facilities</Text> : null}
      <Row gap={2} wrap>
        {hotel.facilities.map((name) => (
          <StatusChip key={name} label={name} tone="neutral" size="sm" />
        ))}
      </Row>
    </Stack>
  );
}
