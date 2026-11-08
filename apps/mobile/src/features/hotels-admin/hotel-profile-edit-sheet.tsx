import { useEffect, useState } from "react";

import { useCreateHotel, useUpdateHotel } from "@ampm/api-client";
import { isAppError, type HotelStaffView, type HotelStatus } from "@ampm/core";
import { Button, Input, InternalPanel, Sheet, Stack, Toggle, useToast } from "@ampm/ui";

import { DestinationField } from "./hotel-destination-field";
import {
  buildHotelBody,
  draftFromHotel,
  hasErrors,
  validateDraft,
  type HotelProfileDraft,
  type HotelProfileErrors,
} from "./hotel-profile.form";
import { hotelStatusLabel } from "./hotels-admin.format";
import { MediaOptionPicker } from "./media-option-picker";

const HOTEL_STATUSES: readonly HotelStatus[] = ["draft", "active", "inactive"];
const NO_ERRORS: HotelProfileErrors = {
  name: undefined,
  destinationId: undefined,
  totalRooms: undefined,
  internalRating: undefined,
};

type Patch = (next: Partial<HotelProfileDraft>) => void;

interface FieldsProps {
  readonly draft: HotelProfileDraft;
  readonly patch: Patch;
  readonly errors: HotelProfileErrors;
}

/** The create/edit form's state, validation and submission; kept out of the view so each stays small. */
function useHotelProfileForm(open: boolean, hotel: HotelStaffView | null, onClose: () => void) {
  const toast = useToast();
  const create = useCreateHotel();
  const update = useUpdateHotel();
  const [draft, setDraft] = useState<HotelProfileDraft>(() => draftFromHotel(hotel));
  const [showErrors, setShowErrors] = useState(false);
  // Re-seed each time the sheet opens, so "New hotel" starts clean and editing shows current values.
  useEffect(() => {
    if (open) {
      setDraft(draftFromHotel(hotel));
      setShowErrors(false);
    }
  }, [open, hotel]);
  const pending = create.isPending || update.isPending;
  const onError = (error: unknown): void =>
    void toast.show({
      title: isAppError(error) ? error.message : "Could not save the hotel",
      tone: "danger",
    });
  const onSuccess = (): void => {
    toast.show({ title: hotel ? "Hotel updated" : "Hotel added", tone: "success" });
    onClose();
  };
  const patch: Patch = (next) => setDraft((prev) => ({ ...prev, ...next }));
  const submit = (): void => {
    if (pending) return;
    if (hasErrors(validateDraft(draft))) return setShowErrors(true);
    const body = buildHotelBody(draft);
    if (hotel) update.mutate({ hotelId: hotel.id, body }, { onSuccess, onError });
    else create.mutate(body, { onSuccess, onError });
  };
  return { draft, patch, errors: showErrors ? validateDraft(draft) : NO_ERRORS, pending, submit };
}

function IdentityFields({
  draft,
  patch,
}: {
  readonly draft: HotelProfileDraft;
  readonly patch: Patch;
}) {
  return (
    <>
      <Input
        label="Brand"
        value={draft.brand}
        onChangeText={(brand) => patch({ brand })}
        placeholder="e.g. Taj Hotels"
        testID="hotel-brand"
      />
      <Input
        label="Star category"
        value={draft.starCategory}
        onChangeText={(starCategory) => patch({ starCategory })}
        placeholder="e.g. 5"
        testID="hotel-star"
      />
      <MediaOptionPicker
        label="Status"
        value={draft.status}
        options={HOTEL_STATUSES}
        optionLabel={hotelStatusLabel}
        onChange={(status) => patch({ status })}
        testID="hotel-status"
      />
    </>
  );
}

function DetailFields({ draft, patch, errors }: FieldsProps) {
  return (
    <>
      <Input
        label="Total rooms"
        value={draft.totalRooms}
        onChangeText={(totalRooms) => patch({ totalRooms })}
        keyboardType="number-pad"
        errorText={errors.totalRooms}
        placeholder="e.g. 120"
        testID="hotel-rooms"
      />
      <Input
        label="Website"
        value={draft.website}
        onChangeText={(website) => patch({ website })}
        keyboardType="url"
        autoCapitalize="none"
        placeholder="https://…"
        testID="hotel-website"
      />
      <Input
        label="Address"
        value={draft.address}
        onChangeText={(address) => patch({ address })}
        multiline
        testID="hotel-address"
      />
      <Input
        label="Client description"
        helpText="Shown to clients in discovery."
        value={draft.descriptionClient}
        onChangeText={(descriptionClient) => patch({ descriptionClient })}
        multiline
        testID="hotel-description"
      />
    </>
  );
}

function FlagFields({
  draft,
  patch,
}: {
  readonly draft: HotelProfileDraft;
  readonly patch: Patch;
}) {
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
function InternalFields({ draft, patch, errors }: FieldsProps) {
  return (
    <InternalPanel testID="hotel-internal">
      <Stack gap={3}>
        <Input
          label="Internal rating (1–5)"
          value={draft.internalRating}
          onChangeText={(internalRating) => patch({ internalRating })}
          keyboardType="number-pad"
          errorText={errors.internalRating}
          testID="hotel-internal-rating"
        />
        <Input
          label="Internal notes"
          value={draft.internalNotes}
          onChangeText={(internalNotes) => patch({ internalNotes })}
          multiline
          testID="hotel-internal-notes"
        />
      </Stack>
    </InternalPanel>
  );
}

export interface HotelProfileEditSheetProps {
  readonly open: boolean;
  /** The hotel being edited, or null to add a new one. */
  readonly hotel: HotelStaffView | null;
  readonly onClose: () => void;
}

/**
 * Add a hotel to the catalogue, or edit one's profile (H1.1b): the client-facing fields and the
 * staff-only internal rating/notes, filed under a destination. The server derives the slug from the
 * name on create (immutable after) and re-validates every field. Rooms, venues, contacts and photos
 * are managed separately. Hotel team and Super Admin only, gated server-side.
 *
 *   <HotelProfileEditSheet open={open} hotel={editing} onClose={close} />
 */
export function HotelProfileEditSheet({ open, hotel, onClose }: HotelProfileEditSheetProps) {
  const { draft, patch, errors, pending, submit } = useHotelProfileForm(open, hotel, onClose);
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
      <Stack gap={4}>
        <Input
          label="Hotel name"
          required
          value={draft.name}
          onChangeText={(name) => patch({ name })}
          errorText={errors.name}
          autoCapitalize="words"
          testID="hotel-name"
        />
        {open ? (
          <DestinationField
            value={draft.destinationId}
            onChange={(destinationId) => patch({ destinationId })}
            error={errors.destinationId}
          />
        ) : null}
        <IdentityFields draft={draft} patch={patch} />
        <DetailFields draft={draft} patch={patch} errors={errors} />
        <FlagFields draft={draft} patch={patch} />
        <InternalFields draft={draft} patch={patch} errors={errors} />
      </Stack>
    </Sheet>
  );
}
