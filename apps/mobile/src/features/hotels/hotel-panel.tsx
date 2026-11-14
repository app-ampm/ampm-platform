import type { HotelDetailView } from "@ampm/core";
import { Card, SegmentedControl, Stack, Text } from "@ampm/ui";

import { HotelFacts } from "./hotel-facts";
import { HotelSectionBody } from "./hotel-sections";
import { destinationLabel, hotelSections, type HotelSection } from "./hotels.format";
import { openSection, sectionOf } from "./hotels.format.desktop";

export interface HotelPanelProps {
  readonly hotel: HotelDetailView;
  /** The client's pick, held by the screen so it survives a switch to the desktop page and back. */
  readonly picked: HotelSection | undefined;
  readonly onPick: (section: HotelSection) => void;
}

/**
 * The glass panel under the hotel's photo on a phone and a tablet (P4): where it is, its name in Gilda
 * Display, its facts as chips, then a tab strip with only the sections the API sent. The page's actions
 * sit in its sticky footer and over the photo. A desktop composes D6 instead (HotelDesktopPage).
 */
export function HotelPanel({ hotel, picked, onPick }: HotelPanelProps) {
  const sections = hotelSections(hotel);
  const current = openSection(sections, picked) ?? "rates";
  const pick = (value: string) => {
    const next = sectionOf(sections, value);
    if (next) onPick(next);
  };
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
          onChange={pick}
        />
      ) : null}
      <HotelSectionBody hotel={hotel} section={current} />
    </Card>
  );
}
