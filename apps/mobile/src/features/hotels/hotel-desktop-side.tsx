import type { HotelDetailView } from "@ampm/core";
import { Stack } from "@ampm/ui";

import { HotelFacilities } from "./hotel-facilities";
import { HotelLocation } from "./hotel-location";
import { HotelRates, RatesFreshnessChip } from "./hotel-rates";
import { HotelSectionCard } from "./hotel-section-card";
import { hasHotelLocation } from "./hotels.format.desktop";

/**
 * The side column of the desktop hotel page (D6), the same at every tab: the Rates panel with its
 * freshness beside the title, where the hotel is (its address and links; D6's street view needs
 * imagery the client view does not carry), and its facilities. Each panel only when it has content;
 * the rates always do (on request is an answer too).
 */
export function HotelDesktopSide({ hotel }: { readonly hotel: HotelDetailView }) {
  return (
    <Stack gap={4.5} testID="hotel-detail-side">
      <HotelSectionCard
        title="Rates"
        trailing={<RatesFreshnessChip rates={hotel.rates} />}
        testID="hotel-side-rates"
      >
        <HotelRates rates={hotel.rates} showFreshness={false} />
      </HotelSectionCard>
      {hasHotelLocation(hotel) ? (
        <HotelSectionCard title="Location" testID="hotel-side-location">
          <HotelLocation hotel={hotel} />
        </HotelSectionCard>
      ) : null}
      {hotel.facilities.length > 0 ? (
        <HotelSectionCard title="Facilities" testID="hotel-side-facilities">
          <HotelFacilities hotel={hotel} showEyebrow={false} />
        </HotelSectionCard>
      ) : null}
    </Stack>
  );
}
