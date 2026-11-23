import { CuisineChips } from "./hotel-cuisine-chips";
import { TRI_STATES } from "./hotel-form-fields";
import type { ProfileFieldsProps } from "./hotel-profile.bindings";
import { ProfileSection } from "./hotel-profile-section";
import { triStateLabel } from "./hotels-admin.format";
import { MediaOptionPicker } from "./media-option-picker";

/** The three yes / no facts, each with Not known first: what the hotel serves and how it cooks. */
function FoodFacts({ draft, patch }: Pick<ProfileFieldsProps, "draft" | "patch">) {
  return (
    <>
      <MediaOptionPicker
        label="Pure vegetarian"
        value={draft.isPureVegetarian}
        options={TRI_STATES}
        optionLabel={triStateLabel}
        onChange={(isPureVegetarian) => patch({ isPureVegetarian })}
        testID="hotel-pure-veg"
      />
      <MediaOptionPicker
        label="Separate vegetarian kitchen"
        value={draft.hasSeparateVegKitchen}
        options={TRI_STATES}
        optionLabel={triStateLabel}
        onChange={(hasSeparateVegKitchen) => patch({ hasSeparateVegKitchen })}
        testID="hotel-veg-kitchen"
      />
      <MediaOptionPicker
        label="Alcohol served"
        value={draft.servesAlcohol}
        options={TRI_STATES}
        optionLabel={triStateLabel}
        onChange={(servesAlcohol) => patch({ servesAlcohol })}
        testID="hotel-alcohol"
      />
    </>
  );
}

export interface HotelFoodFieldsProps extends ProfileFieldsProps {
  /** The cuisine options load only while the editor is open. */
  readonly open: boolean;
  /** The cuisines the hotel had when the editor opened (none for a new hotel). */
  readonly savedCuisines: readonly string[];
}

/**
 * The profile editor's "Food and beverage" section (D-178): the hotel's cuisines as chips, then three
 * facts as Not known / Yes / No. Not known saves null, so a hotel that has not said is never recorded
 * as a "no"; that is why these are pickers and never toggles.
 *
 *   <HotelFoodFields open={open} savedCuisines={hotel?.cuisines ?? []} {...fields} />
 */
export function HotelFoodFields({ open, savedCuisines, ...props }: HotelFoodFieldsProps) {
  const { draft, patch, errors } = props;
  return (
    <ProfileSection
      title="Food and beverage"
      description="Not known means the hotel has not said; it is never saved as a no."
      testID="hotel-food"
    >
      <CuisineChips
        open={open}
        chosen={draft.cuisines}
        saved={savedCuisines}
        onChange={(cuisines) => patch({ cuisines })}
        error={errors.cuisines}
      />
      <FoodFacts draft={draft} patch={patch} />
    </ProfileSection>
  );
}
