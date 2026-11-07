import { useState } from "react";

import type { HotelDetailView } from "@ampm/core";
import { Card, Row, SegmentedControl, Stack, StatusChip, Text } from "@ampm/ui";

import { HotelSectionBody } from "./hotel-sections";
import {
  destinationLabel,
  hotelSections,
  roomsLabel,
  starLabel,
  type HotelSection,
} from "./hotels.format";

/**
 * The glass panel under the hotel's photo (D6, P4): where it is, its name in Gilda Display, its
 * facts as chips, then a tab strip with only the sections the API sent. The page's actions sit in its
 * sticky footer and over the photo.
 */
export function HotelPanel({ hotel }: { readonly hotel: HotelDetailView }) {
  const sections = hotelSections(hotel);
  const [picked, setPicked] = useState<string>(sections[0]?.value ?? "rates");
  const current: HotelSection =
    sections.find((section) => section.value === picked)?.value ?? "rates";
  return (
    <Card padding="lg" className="gap-4 md:p-8">
      <Stack gap={2}>
        <Text variant="eyebrow">{destinationLabel(hotel.destination)}</Text>
        <Text variant="title">{hotel.name}</Text>
        <HotelFacts hotel={hotel} />
      </Stack>
      {/* One section needs no tabs: the rates alone are shown as they are. */}
      {sections.length > 1 ? (
        <SegmentedControl
          accessibilityLabel="Hotel sections"
          scrollable
          options={sections}
          value={current}
          onChange={setPicked}
        />
      ) : null}
      <HotelSectionBody hotel={hotel} section={current} />
    </Card>
  );
}

/** The star category (a highlight) and the size (a plain fact), as P4's chips under the name. */
function HotelFacts({ hotel }: { readonly hotel: HotelDetailView }) {
  if (!hotel.starCategory && hotel.totalRooms === null) return null;
  return (
    <Row gap={2} wrap>
      {hotel.starCategory ? (
        <StatusChip label={starLabel(hotel.starCategory)} tone="brand" size="sm" icon="star" />
      ) : null}
      {hotel.totalRooms === null ? null : (
        <StatusChip label={roomsLabel(hotel.totalRooms)} tone="info" size="sm" />
      )}
    </Row>
  );
}
