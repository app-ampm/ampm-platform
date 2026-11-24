import { Input } from "@ampm/ui";

import { ProfileSection } from "./hotel-profile-section";
import { venueField, type VenueFieldsProps } from "./use-venue-form";
import { VENUE_FIELD_LABEL } from "./venues.form";

/** The longest capacity note the contract takes. */
const NOTES_MAX = 1_000;

/**
 * The venue's three capacities, each labelled with what it counts (decision 11): seated at round tables
 * for dinner, theatre in rows of chairs, floating for a standing reception. Each takes one number, the
 * most; a range or a condition goes in the notes.
 *
 *   <VenueCapacityPanel {...fields} />
 */
export function VenueCapacityPanel(props: VenueFieldsProps) {
  const { draft, patch } = props;
  return (
    <ProfileSection
      title="Capacity"
      description="One number each: the most guests. Put a range or a condition in the notes."
      testID="venue-capacity"
    >
      <Input
        label={VENUE_FIELD_LABEL.capacityBanquet}
        {...venueField(props, "capacityBanquet")}
        keyboardType="number-pad"
        testID="venue-banquet"
      />
      <Input
        label={VENUE_FIELD_LABEL.capacityTheatre}
        {...venueField(props, "capacityTheatre")}
        keyboardType="number-pad"
        testID="venue-theatre"
      />
      <Input
        label={VENUE_FIELD_LABEL.capacityReception}
        {...venueField(props, "capacityReception")}
        keyboardType="number-pad"
        testID="venue-reception"
      />
      <Input
        label="Capacity notes"
        helpText="For example: 600 to 700 seated with the stage in."
        value={draft.capacityNotes}
        onChangeText={(capacityNotes) => patch({ capacityNotes })}
        multiline
        maxLength={NOTES_MAX}
        testID="venue-capacity-notes"
      />
    </ProfileSection>
  );
}
