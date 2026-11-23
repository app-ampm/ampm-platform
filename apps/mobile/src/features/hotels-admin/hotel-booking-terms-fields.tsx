import { Input, InternalPanel, Stack } from "@ampm/ui";

import { checkedField, textField, type ProfileFieldsProps } from "./hotel-profile.bindings";
import {
  BUYOUT_CHOICES,
  buyoutChoiceLabel,
  PARALLEL_CHOICES,
  parallelChoiceLabel,
} from "./hotels-admin.format";
import { MediaOptionPicker } from "./media-option-picker";

/** The longest booking notes the contract takes. */
const LONG_TEXT_MAX = 10_000;

/** The fewest rooms a wedding takes without a full buyout, and the fewest nights. */
function StayMinimums(props: ProfileFieldsProps) {
  return (
    <>
      <Input
        label="Minimum rooms without a buyout"
        {...checkedField(props, "minRoomsWithoutBuyout")}
        keyboardType="number-pad"
        testID="hotel-min-rooms"
      />
      <Input
        label="Minimum nights"
        {...checkedField(props, "minNights")}
        keyboardType="number-pad"
        testID="hotel-min-nights"
      />
    </>
  );
}

/**
 * The hotel's booking terms (D-178, decision 12) in the dashed-gold internal panel: whether a wedding
 * needs the whole hotel, the fewest rooms without a buyout and the fewest nights, whether several
 * functions may run at once, and notes. INTERNAL: every profile editor sees and sets them (they are not
 * the restricted internal rating and notes), and no client view carries them. "Not set" saves null.
 *
 *   <HotelBookingTermsFields draft={draft} patch={patch} errors={errors} fieldRef={fieldRef} />
 */
export function HotelBookingTermsFields(props: ProfileFieldsProps) {
  const { draft, patch } = props;
  return (
    <InternalPanel label="Booking terms · seen only by AMPM" testID="hotel-booking-terms">
      <Stack gap={4}>
        <MediaOptionPicker
          label="Full-hotel buyout for weddings"
          value={draft.weddingBuyoutPolicy}
          options={BUYOUT_CHOICES}
          optionLabel={buyoutChoiceLabel}
          onChange={(weddingBuyoutPolicy) => patch({ weddingBuyoutPolicy })}
          testID="hotel-buyout"
        />
        <StayMinimums {...props} />
        <MediaOptionPicker
          label="Several functions at once"
          value={draft.parallelFunctions}
          options={PARALLEL_CHOICES}
          optionLabel={parallelChoiceLabel}
          onChange={(parallelFunctions) => patch({ parallelFunctions })}
          testID="hotel-parallel"
        />
        <Input
          label="Booking notes"
          {...textField(props, "bookingNotes")}
          multiline
          maxLength={LONG_TEXT_MAX}
          testID="hotel-booking-notes"
        />
      </Stack>
    </InternalPanel>
  );
}
