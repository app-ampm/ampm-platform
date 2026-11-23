import { Input } from "@ampm/ui";

import { checkedField, type ProfileFieldsProps } from "./hotel-profile.bindings";
import { ProfileSection } from "./hotel-profile-section";

/**
 * The profile editor's "Event space" section (D-178): all the hotel's function space together, in m²
 * and in sq ft, each kept as the hotel published it (a fact sheet may give one, the other or both), so
 * neither is converted here.
 *
 *   <HotelEventSpaceFields draft={draft} patch={patch} errors={errors} fieldRef={fieldRef} />
 */
export function HotelEventSpaceFields(props: ProfileFieldsProps) {
  return (
    <ProfileSection
      title="Event space"
      description="All the function space together, as the hotel states it: in m², sq ft or both."
      testID="hotel-event-space"
    >
      <Input
        label="Total event space (m²)"
        {...checkedField(props, "totalEventSpaceSqm")}
        keyboardType="number-pad"
        testID="hotel-event-space-sqm"
      />
      <Input
        label="Total event space (sq ft)"
        {...checkedField(props, "totalEventSpaceSqft")}
        keyboardType="number-pad"
        testID="hotel-event-space-sqft"
      />
    </ProfileSection>
  );
}
