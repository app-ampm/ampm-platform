import type { HotelDetailView } from "@ampm/core";
import { Stack, Text } from "@ampm/ui";

import { HotelSectionBody } from "./hotel-sections";
import { HotelSectionCard } from "./hotel-section-card";
import { HotelVenueTable } from "./hotel-venue-table";
import { desktopSectionTitle, type DesktopSectionOption } from "./hotels.format.desktop";

type DesktopSection = DesktopSectionOption["value"];

export interface HotelDesktopMainProps {
  readonly hotel: HotelDetailView;
  readonly section: DesktopSection;
}

/** One section as a glass panel: the venues as D6's table, any other as the phone's section body. */
function SectionPanel({ hotel, section }: HotelDesktopMainProps) {
  return (
    <HotelSectionCard title={desktopSectionTitle(section)} testID={`hotel-section-${section}`}>
      {section === "venues" ? (
        <HotelVenueTable venues={hotel.venues} />
      ) : section === "overview" ? (
        <Text>{hotel.description}</Text>
      ) : (
        <HotelSectionBody hotel={hotel} section={section} />
      )}
    </HotelSectionCard>
  );
}

/** The panels the overview stacks (D6): the description, then the venues, rooms and weddings it has. */
function overviewPanels(hotel: HotelDetailView): DesktopSection[] {
  return [
    hotel.description ? "overview" : null,
    hotel.venues.length > 0 ? "venues" : null,
    hotel.rooms.length > 0 ? "rooms" : null,
    hotel.references.length > 0 ? "weddings" : null,
  ].filter((section): section is DesktopSection => section !== null);
}

/**
 * The main column of the desktop hotel page (D6): the open tab's section as a glass panel, or, on the
 * overview, every panel the hotel has at a glance, 18 apart as D6 stacks them.
 */
export function HotelDesktopMain({ hotel, section }: HotelDesktopMainProps) {
  const panels = section === "overview" ? overviewPanels(hotel) : [section];
  return (
    <Stack gap={4.5} testID="hotel-detail-main">
      {panels.map((panel) => (
        <SectionPanel key={panel} hotel={hotel} section={panel} />
      ))}
    </Stack>
  );
}
