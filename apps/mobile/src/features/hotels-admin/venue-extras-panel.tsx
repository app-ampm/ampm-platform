import { Input } from "@ampm/ui";

import { AreaFields } from "./area-fields";
import { PREFUNCTION_AREA } from "./hotel-area.form";
import { LONG_TEXT_MAX } from "./hotel-form-fields";
import { ProfileSection } from "./hotel-profile-section";
import { venueField, type VenueFieldsProps } from "./use-venue-form";
import { VENUE_FIELD_LABEL } from "./venues.form";

/**
 * The venue editor's last panel: the pre-function area where guests gather before an event (in both
 * units, the m² worked out from a filled sq ft), the venue's amenities one per line, and its description.
 *
 *   <VenueExtrasPanel {...fields} />
 */
export function VenueExtrasPanel(props: VenueFieldsProps) {
  const { draft, patch } = props;
  return (
    <ProfileSection title="Pre-function and amenities" testID="venue-extras">
      <AreaFields
        sqmLabel={VENUE_FIELD_LABEL.prefunctionAreaSqm}
        sqftLabel={VENUE_FIELD_LABEL.prefunctionAreaSqft}
        sqm={venueField(props, "prefunctionAreaSqm")}
        sqft={venueField(props, "prefunctionAreaSqft")}
        rules={PREFUNCTION_AREA}
        sqmTestID="venue-prefunction"
        sqftTestID="venue-prefunction-sqft"
      />
      <Input
        label={VENUE_FIELD_LABEL.facilities}
        helpText="One per line; a | also separates two."
        {...venueField(props, "facilities")}
        multiline
        testID="venue-facilities"
      />
      <Input
        label="Description"
        value={draft.description}
        onChangeText={(description) => patch({ description })}
        multiline
        maxLength={LONG_TEXT_MAX}
        testID="venue-description"
      />
    </ProfileSection>
  );
}
