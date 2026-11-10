import { useEffect, useState } from "react";

import { useCreateVenue, useUpdateVenue } from "@ampm/api-client";
import { isAppError, type HotelVenueType, type VenueView } from "@ampm/core";
import { Button, Input, Sheet, Stack, Toggle, useToast } from "@ampm/ui";

import { hasErrors } from "./hotel-form-fields";
import { venueTypeLabel } from "./hotels-admin.format";
import { MediaOptionPicker } from "./media-option-picker";
import {
  buildVenueBody,
  draftFromVenue,
  validateVenue,
  type VenueDraft,
  type VenueErrors,
} from "./subresources.form";

const VENUE_TYPES: readonly HotelVenueType[] = [
  "ballroom",
  "lawn",
  "poolside",
  "rooftop",
  "courtyard",
  "beach",
  "other",
];
const NO_ERRORS: VenueErrors = {
  name: undefined,
  areaSqm: undefined,
  capacityBanquet: undefined,
  capacityTheatre: undefined,
  capacityReception: undefined,
};

type Patch = (next: Partial<VenueDraft>) => void;

/** The venue create/edit form's state, validation and submission. */
function useVenueForm(
  hotelId: string,
  open: boolean,
  venue: VenueView | null,
  onClose: () => void,
) {
  const toast = useToast();
  const create = useCreateVenue(hotelId);
  const update = useUpdateVenue(hotelId);
  const [draft, setDraft] = useState<VenueDraft>(() => draftFromVenue(venue));
  const [showErrors, setShowErrors] = useState(false);
  useEffect(() => {
    if (open) {
      setDraft(draftFromVenue(venue));
      setShowErrors(false);
    }
  }, [open, venue]);
  const pending = create.isPending || update.isPending;
  const onError = (error: unknown): void =>
    void toast.show({
      title: isAppError(error) ? error.message : "Could not save the venue",
      tone: "danger",
    });
  const onSuccess = (): void => {
    toast.show({ title: venue ? "Venue updated" : "Venue added", tone: "success" });
    onClose();
  };
  const patch: Patch = (next) => setDraft((prev) => ({ ...prev, ...next }));
  const submit = (): void => {
    if (pending) return;
    if (hasErrors(validateVenue(draft))) return setShowErrors(true);
    const body = buildVenueBody(draft);
    if (venue) update.mutate({ venueId: venue.id, body }, { onSuccess, onError });
    else create.mutate(body, { onSuccess, onError });
  };
  return { draft, patch, errors: showErrors ? validateVenue(draft) : NO_ERRORS, pending, submit };
}

/** The venue's area and the three seating capacities the catalogue and discovery use. */
function CapacityFields({
  draft,
  patch,
  errors,
}: {
  readonly draft: VenueDraft;
  readonly patch: Patch;
  readonly errors: VenueErrors;
}) {
  return (
    <>
      <Input
        label="Area (sqm)"
        value={draft.areaSqm}
        onChangeText={(areaSqm) => patch({ areaSqm })}
        keyboardType="number-pad"
        errorText={errors.areaSqm}
        testID="venue-area"
      />
      <Input
        label="Banquet capacity"
        value={draft.capacityBanquet}
        onChangeText={(capacityBanquet) => patch({ capacityBanquet })}
        keyboardType="number-pad"
        errorText={errors.capacityBanquet}
        testID="venue-banquet"
      />
      <Input
        label="Theatre capacity"
        value={draft.capacityTheatre}
        onChangeText={(capacityTheatre) => patch({ capacityTheatre })}
        keyboardType="number-pad"
        errorText={errors.capacityTheatre}
        testID="venue-theatre"
      />
      <Input
        label="Reception capacity"
        value={draft.capacityReception}
        onChangeText={(capacityReception) => patch({ capacityReception })}
        keyboardType="number-pad"
        errorText={errors.capacityReception}
        testID="venue-reception"
      />
    </>
  );
}

export interface VenueEditSheetProps {
  readonly hotelId: string;
  readonly open: boolean;
  /** The venue being edited, or null to add a new one. */
  readonly venue: VenueView | null;
  readonly onClose: () => void;
}

/** Add or edit a hotel event venue (type, indoor/outdoor, capacities, facilities). HT / SA only. */
export function VenueEditSheet({ hotelId, open, venue, onClose }: VenueEditSheetProps) {
  const { draft, patch, errors, pending, submit } = useVenueForm(hotelId, open, venue, onClose);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={venue ? "Edit venue" : "New venue"}
      size="full"
      testID="venue-edit"
      footer={
        <Button fullWidth loading={pending} onPress={submit} testID="venue-edit-submit">
          {venue ? "Save changes" : "Add venue"}
        </Button>
      }
    >
      <Stack gap={4}>
        <Input
          label="Name"
          required
          value={draft.name}
          onChangeText={(name) => patch({ name })}
          errorText={errors.name}
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
        <Toggle
          label="Indoor"
          value={draft.isIndoor}
          onValueChange={(isIndoor) => patch({ isIndoor })}
          testID="venue-indoor"
        />
        <CapacityFields draft={draft} patch={patch} errors={errors} />
        <Input
          label="Facilities"
          helpText="Comma-separated, e.g. stage, AV, parking"
          value={draft.facilities}
          onChangeText={(facilities) => patch({ facilities })}
          testID="venue-facilities"
        />
        <Input
          label="Description"
          value={draft.description}
          onChangeText={(description) => patch({ description })}
          multiline
          testID="venue-description"
        />
      </Stack>
    </Sheet>
  );
}
