import type { HotelDetailView } from "@ampm/core";
import { Columns, SegmentedControl, Stack } from "@ampm/ui";

import type { HotelPagePermissions } from "./hotel-actions";
import { HotelDesktopMain } from "./hotel-desktop-main";
import { HotelDesktopSide } from "./hotel-desktop-side";
import { HotelMosaic } from "./hotel-mosaic";
import { HotelTitleBlock } from "./hotel-title-block";
import type { HotelSection } from "./hotels.format";
import { desktopSections, openSection, sectionOf } from "./hotels.format.desktop";

export interface HotelDesktopPageProps {
  readonly hotel: HotelDetailView;
  readonly permissions: HotelPagePermissions;
  readonly onBack: () => void;
  /** The client's pick, held by the screen so it survives a switch to the phone page and back. */
  readonly picked: HotelSection | undefined;
  readonly onPick: (section: HotelSection) => void;
}

/**
 * The hotel page on a desktop (D6): the photo mosaic across the page, then, 40 further in, the title
 * block on the background, a tab pill as wide as its tabs, and two columns at 1.6 : 1, the open tab's
 * panels beside the rates, location and facilities, which stay at every tab. The page's actions sit
 * at the title's right, so there is no sticky bar.
 */
export function HotelDesktopPage({
  hotel,
  permissions,
  onBack,
  picked,
  onPick,
}: HotelDesktopPageProps) {
  const sections = desktopSections(hotel);
  const current = openSection(sections, picked);
  const media = sections.find(
    (section) => section.value === "gallery" || section.value === "video",
  );
  const pick = (value: string) => {
    const next = sectionOf(sections, value);
    if (next) onPick(next);
  };
  return (
    <>
      <HotelMosaic hotel={hotel} onBack={onBack} onShowAll={() => media && onPick(media.value)} />
      <Stack gap={6} className="px-10 pt-4">
        <HotelTitleBlock hotel={hotel} permissions={permissions} />
        {sections.length > 1 ? (
          <SegmentedControl
            accessibilityLabel="Hotel sections"
            options={sections}
            value={current ?? ""}
            onChange={pick}
          />
        ) : null}
        <Columns ratios={[1.6, 1]} align="start" testID="hotel-detail-columns">
          {current ? <HotelDesktopMain hotel={hotel} section={current} /> : null}
          <HotelDesktopSide hotel={hotel} />
        </Columns>
      </Stack>
    </>
  );
}
