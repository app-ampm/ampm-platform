import { Input } from "@ampm/ui";

import { AreaFields } from "./area-fields";
import { VENUE_AREA } from "./hotel-area.form";
import { ProfileSection } from "./hotel-profile-section";
import { venueField, type VenueFieldsProps } from "./use-venue-form";
import { VENUE_FIELD_LABEL } from "./venues.form";

/**
 * The venue's size: its floor area in both units (the m² worked out from a filled sq ft), then its
 * length, width and ceiling height in metres, to two decimal places.
 *
 *   <VenueSizePanel {...fields} />
 */
export function VenueSizePanel(props: VenueFieldsProps) {
  return (
    <ProfileSection
      title="Size"
      description="Lengths in metres, to two decimal places."
      testID="venue-size"
    >
      <AreaFields
        sqmLabel={VENUE_FIELD_LABEL.areaSqm}
        sqftLabel={VENUE_FIELD_LABEL.areaSqft}
        sqm={venueField(props, "areaSqm")}
        sqft={venueField(props, "areaSqft")}
        rules={VENUE_AREA}
        sqmTestID="venue-area"
        sqftTestID="venue-area-sqft"
      />
      <Input
        label={VENUE_FIELD_LABEL.lengthM}
        {...venueField(props, "lengthM")}
        keyboardType="decimal-pad"
        testID="venue-length"
      />
      <Input
        label={VENUE_FIELD_LABEL.widthM}
        {...venueField(props, "widthM")}
        keyboardType="decimal-pad"
        testID="venue-width"
      />
      <Input
        label={VENUE_FIELD_LABEL.ceilingHeightM}
        {...venueField(props, "ceilingHeightM")}
        keyboardType="decimal-pad"
        testID="venue-ceiling"
      />
    </ProfileSection>
  );
}
