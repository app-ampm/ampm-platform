import { AreaFields } from "./area-fields";
import { EVENT_SPACE_AREA } from "./hotel-area.form";
import { checkedField, type ProfileFieldsProps } from "./hotel-profile.bindings";
import { ProfileSection } from "./hotel-profile-section";

/**
 * The profile editor's "Event space" section (D-178): all the hotel's function space together. A fact
 * sheet may give sq ft, m² or both; with the sq ft filled, the m² is worked out from it (read-only, the
 * figure the server stores), and with no sq ft the m² is typed as the hotel states it.
 *
 *   <HotelEventSpaceFields draft={draft} patch={patch} errors={errors} fieldRef={fieldRef} />
 */
export function HotelEventSpaceFields(props: ProfileFieldsProps) {
  return (
    <ProfileSection
      title="Event space"
      description="All the function space together. Give the sq ft and the m² is worked out from it; with no sq ft, type the m² the hotel states."
      testID="hotel-event-space"
    >
      <AreaFields
        sqmLabel="Total event space (m²)"
        sqftLabel="Total event space (sq ft)"
        sqm={checkedField(props, "totalEventSpaceSqm")}
        sqft={checkedField(props, "totalEventSpaceSqft")}
        rules={EVENT_SPACE_AREA}
        sqmTestID="hotel-event-space-sqm"
        sqftTestID="hotel-event-space-sqft"
      />
    </ProfileSection>
  );
}
