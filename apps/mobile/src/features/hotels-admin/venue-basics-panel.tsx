import { Input } from "@ampm/ui";

import { ProfileSection } from "./hotel-profile-section";
import { MediaOptionPicker } from "./media-option-picker";
import {
  VENUE_SETTINGS,
  VENUE_TYPES,
  venueSettingLabel,
  venueTypeLabel,
} from "./subresources.format";
import { venueField, type VenueFieldsProps } from "./use-venue-form";
import { VENUE_FIELD_LABEL } from "./venues.form";

/** The longest venue name the contract takes. */
const NAME_MAX = 255;

/**
 * The venue editor's first panel: its name, its type (Other last) and its setting, which a new venue
 * must be given: indoor, outdoor, or covered or semi-open.
 *
 *   <VenueBasicsPanel {...fields} />
 */
export function VenueBasicsPanel(props: VenueFieldsProps) {
  const { draft, patch, errors } = props;
  return (
    <ProfileSection title="Venue" testID="venue-basics">
      <Input
        label={VENUE_FIELD_LABEL.name}
        required
        {...venueField(props, "name")}
        maxLength={NAME_MAX}
        placeholder="e.g. Grand Ballroom"
        testID="venue-name"
      />
      <MediaOptionPicker
        label="Type"
        value={draft.venueType}
        options={VENUE_TYPES}
        optionLabel={venueTypeLabel}
        onChange={(venueType) => patch({ venueType })}
        testID="venue-type"
      />
      <MediaOptionPicker
        label={VENUE_FIELD_LABEL.setting}
        value={draft.setting === "unset" ? null : draft.setting}
        options={VENUE_SETTINGS}
        optionLabel={venueSettingLabel}
        onChange={(setting) => patch({ setting })}
        errorText={errors.setting}
        required
        testID="venue-setting"
      />
    </ProfileSection>
  );
}
