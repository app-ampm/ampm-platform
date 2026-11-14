import type { HotelDetailView } from "@ampm/core";
import { Icon, Row, Stack, Text } from "@ampm/ui";

import { HotelLinks } from "./hotel-links";
import { hasHotelLocation } from "./hotels.format.desktop";

/**
 * Where the hotel is: its address, then the links to its website and to a map (CP-05). The phone's
 * overview ends with it; the desktop page keeps it in the side column's Location card (D6). Nothing
 * when the hotel has neither an address nor a link.
 */
export function HotelLocation({ hotel }: { readonly hotel: HotelDetailView }) {
  if (!hasHotelLocation(hotel)) return null;
  return (
    <Stack gap={3}>
      {hotel.address ? (
        <Row gap={2} align="start">
          <Icon name="map-pin" size="sm" tone="muted" />
          <Text variant="bodySmall" tone="muted" className="flex-1">
            {hotel.address}
          </Text>
        </Row>
      ) : null}
      <HotelLinks hotel={hotel} />
    </Stack>
  );
}
