import { Stack } from "@ampm/ui";

import { MediaRightsPanel } from "./media-rights-panel";
import { RatesVerificationPanel } from "./rates-verification-panel";

/** T5's 300 column beside the rate cards: verification, then media rights when the hotel has media. */
export function HotelRatesSide({ hotelId }: { readonly hotelId: string }) {
  return (
    <Stack gap={4.5} testID="rates-side">
      <RatesVerificationPanel hotelId={hotelId} />
      <MediaRightsPanel hotelId={hotelId} />
    </Stack>
  );
}
