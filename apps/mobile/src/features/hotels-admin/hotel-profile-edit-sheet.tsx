import type { HotelStaffListItem } from "@ampm/core";
import { Button, Input, InternalPanel, Sheet, Stack, Toggle } from "@ampm/ui";

import { HotelBookingTermsFields } from "./hotel-booking-terms-fields";
import { DestinationField } from "./hotel-destination-field";
import { HotelDetailFields } from "./hotel-detail-fields";
import { HotelEventSpaceFields } from "./hotel-event-space-fields";
import { HotelFoodFields } from "./hotel-food-fields";
import { HotelIdentityFields } from "./hotel-identity-fields";
import { HotelLocationFields } from "./hotel-location-fields";
import { checkedField, type ProfileFieldsProps } from "./hotel-profile.bindings";
import { useHotelProfileForm } from "./use-hotel-profile-form";

/** The longest hotel name the contract takes. */
const NAME_MAX = 255;

function FlagFields({ draft, patch }: Pick<ProfileFieldsProps, "draft" | "patch">) {
  return (
    <Stack gap={3}>
      <Toggle
        label="Visible in demo apps"
        value={draft.demoVisible}
        onValueChange={(demoVisible) => patch({ demoVisible })}
        testID="hotel-demo"
      />
      <Toggle
        label="Feature on the public website"
        value={draft.publicShowcase}
        onValueChange={(publicShowcase) => patch({ publicShowcase })}
        testID="hotel-showcase"
      />
    </Stack>
  );
}

/**
 * Staff-only fields (RESTRICTED-NOTES) inside the shared InternalPanel, whose dashed-gold frame and
 * "INTERNAL · NEVER SENT TO CLIENTS" header keep them unmistakable from the client-facing fields above.
 */
function InternalFields(props: ProfileFieldsProps) {
  return (
    <InternalPanel testID="hotel-internal">
      <Stack gap={3}>
        <Input
          label="Internal rating (1–5)"
          {...checkedField(props, "internalRating")}
          keyboardType="number-pad"
          testID="hotel-internal-rating"
        />
        <Input
          label="Internal notes"
          {...checkedField(props, "internalNotes")}
          multiline
          testID="hotel-internal-notes"
        />
      </Stack>
    </InternalPanel>
  );
}

interface HotelProfileFieldsProps extends ProfileFieldsProps {
  readonly open: boolean;
  readonly onAddDestination: (() => void) | undefined;
  readonly notesEditable: boolean;
  readonly savedCuisines: readonly string[];
}

/**
 * The name and destination first, then who the hotel is and its details, its location and access, its
 * event space, its food and beverage, its flags and its booking terms, and the internal rating and notes
 * last for someone who edits them (the order of TW-22's Profile tab). The destination picker mounts only
 * while the sheet is open (its query runs then), and offers the way to Destinations when there is none.
 */
function HotelProfileFields({
  open,
  onAddDestination,
  notesEditable,
  savedCuisines,
  ...fields
}: HotelProfileFieldsProps) {
  const { draft, patch, errors } = fields;
  return (
    <Stack gap={4}>
      <Input
        label="Hotel name"
        required
        {...checkedField(fields, "name")}
        autoCapitalize="words"
        maxLength={NAME_MAX}
        testID="hotel-name"
      />
      {open ? (
        <DestinationField
          value={draft.destinationId}
          onChange={(destinationId) => patch({ destinationId })}
          error={errors.destinationId}
          onAddDestination={onAddDestination}
        />
      ) : null}
      <HotelIdentityFields {...fields} />
      <HotelDetailFields {...fields} />
      <HotelLocationFields {...fields} />
      <HotelEventSpaceFields {...fields} />
      <HotelFoodFields open={open} savedCuisines={savedCuisines} {...fields} />
      <FlagFields draft={draft} patch={patch} />
      <HotelBookingTermsFields {...fields} />
      {notesEditable ? <InternalFields {...fields} /> : null}
    </Stack>
  );
}

export interface HotelProfileEditSheetProps {
  readonly open: boolean;
  /** The hotel being edited, in the reader's model, or null to add a new one. */
  readonly hotel: HotelStaffListItem | null;
  readonly onClose: () => void;
  /** When no destination exists yet, the destination field's way to the Destinations screen. */
  readonly onAddDestination?: (() => void) | undefined;
}

/**
 * Add a hotel to the catalogue, or edit one's profile (H1.1b, D-178): who it is, its details, its
 * location and access, its event space, its food and beverage, its booking terms (internal, every
 * profile editor) and, for someone who may set them, the staff-only internal rating and notes, filed
 * under a destination.
 * The server derives the slug from the name on create (immutable after) and re-validates every field.
 * Rooms, venues, contacts and photos are managed separately. Hotel team and Super Admin only, gated
 * server-side.
 *
 *   <HotelProfileEditSheet open={open} hotel={editing} onClose={close} />
 */
export function HotelProfileEditSheet({
  open,
  hotel,
  onClose,
  onAddDestination,
}: HotelProfileEditSheetProps) {
  const { pending, submit, ...form } = useHotelProfileForm(open, hotel, onClose);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={hotel ? "Edit hotel" : "New hotel"}
      size="full"
      testID="hotel-profile-edit"
      footer={
        <Button fullWidth loading={pending} onPress={submit} testID="hotel-profile-submit">
          {hotel ? "Save changes" : "Add hotel"}
        </Button>
      }
    >
      <HotelProfileFields
        open={open}
        onAddDestination={onAddDestination}
        savedCuisines={hotel?.cuisines ?? []}
        {...form}
      />
    </Sheet>
  );
}
