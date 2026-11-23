import { useEffect, useState } from "react";

import { useCreateDestination, useUpdateDestination } from "@ampm/api-client";
import { isAppError, type DestinationView } from "@ampm/core";
import { Button, Input, Sheet, Stack, Text, Toggle, useToast } from "@ampm/ui";

import {
  buildDestinationCreateBody,
  buildDestinationUpdateBody,
  draftFromDestination,
  validateDestination,
  type DestinationDraft,
  type DestinationErrors,
} from "./destinations.form";
import { hasErrors } from "./hotel-form-fields";
import { HOTEL_STATUSES, hotelStatusLabel } from "./hotels-admin.format";
import { MediaOptionPicker } from "./media-option-picker";

const NO_ERRORS: DestinationErrors = {
  name: undefined,
  slug: undefined,
  region: undefined,
  state: undefined,
  country: undefined,
  description: undefined,
};

type Patch = (next: Partial<DestinationDraft>) => void;

interface FieldsProps {
  readonly draft: DestinationDraft;
  readonly patch: Patch;
  readonly errors: DestinationErrors;
}

/** Saving the draft: create or update, a toast either way, and closing on success. */
function useDestinationSave(destination: DestinationView | null, onClose: () => void) {
  const toast = useToast();
  const create = useCreateDestination();
  const update = useUpdateDestination();
  const onError = (error: unknown): void =>
    void toast.show({
      title: isAppError(error) ? error.message : "Could not save the destination",
      tone: "danger",
    });
  const onSuccess = (): void => {
    toast.show({
      title: destination ? "Destination updated" : "Destination added",
      tone: "success",
    });
    onClose();
  };
  const save = (draft: DestinationDraft): void => {
    if (destination) {
      const body = buildDestinationUpdateBody(draft);
      update.mutate({ destinationId: destination.id, body }, { onSuccess, onError });
    } else {
      create.mutate(buildDestinationCreateBody(draft), { onSuccess, onError });
    }
  };
  return { save, pending: create.isPending || update.isPending };
}

/** The form's state and validation; a fresh draft each time the sheet opens. */
function useDestinationForm(
  open: boolean,
  destination: DestinationView | null,
  onClose: () => void,
) {
  const { save, pending } = useDestinationSave(destination, onClose);
  const [draft, setDraft] = useState<DestinationDraft>(() => draftFromDestination(destination));
  const [showErrors, setShowErrors] = useState(false);
  useEffect(() => {
    if (open) {
      setDraft(draftFromDestination(destination));
      setShowErrors(false);
    }
  }, [open, destination]);
  const isNew = destination === null;
  const patch: Patch = (next) => setDraft((prev) => ({ ...prev, ...next }));
  const submit = (): void => {
    if (pending) return;
    if (hasErrors(validateDestination(draft, isNew))) return setShowErrors(true);
    save(draft);
  };
  const errors = showErrors ? validateDestination(draft, isNew) : NO_ERRORS;
  return { draft, patch, errors, pending, submit };
}

/** The web address: typed once when the destination is added, then shown as it is. */
function SlugField({ slug, ...props }: FieldsProps & { readonly slug: string | null }) {
  if (slug !== null) {
    return (
      <Stack gap={1.5}>
        <Text variant="eyebrow" tone="muted">
          Web address
        </Text>
        <Text variant="data" testID="destination-slug-fixed">
          {slug}
        </Text>
        <Text variant="bodySmall" tone="muted">
          Set when the destination was added; it can&apos;t change. The hotel import finds
          destinations by it.
        </Text>
      </Stack>
    );
  }
  return (
    <Input
      label="Web address"
      helpText="Optional: left blank, it is made from the name. It can't change later, and the hotel import finds destinations by it."
      value={props.draft.slug}
      onChangeText={(value) => props.patch({ slug: value })}
      autoCapitalize="none"
      errorText={props.errors.slug}
      placeholder="e.g. north-goa"
      testID="destination-slug"
    />
  );
}

/** Where the destination is: its region, state and country. */
function PlaceFields({ draft, patch, errors }: FieldsProps) {
  return (
    <>
      <Input
        label="Region"
        value={draft.region}
        onChangeText={(region) => patch({ region })}
        errorText={errors.region}
        placeholder="e.g. Mewar"
        autoCapitalize="words"
        testID="destination-region"
      />
      <Input
        label="State"
        value={draft.state}
        onChangeText={(state) => patch({ state })}
        errorText={errors.state}
        placeholder="e.g. Rajasthan"
        autoCapitalize="words"
        testID="destination-state"
      />
      <Input
        label="Country"
        required
        value={draft.country}
        onChangeText={(country) => patch({ country })}
        errorText={errors.country}
        autoCapitalize="words"
        testID="destination-country"
      />
    </>
  );
}

/** Who sees it: the status, which clients' destination list follows, and the website flag. */
function VisibilityFields({ draft, patch }: Pick<FieldsProps, "draft" | "patch">) {
  return (
    <Stack gap={3}>
      <Stack gap={1.5}>
        <MediaOptionPicker
          label="Status"
          value={draft.status}
          options={HOTEL_STATUSES}
          optionLabel={hotelStatusLabel}
          onChange={(status) => patch({ status })}
          testID="destination-status"
        />
        <Text variant="bodySmall" tone="muted">
          Clients see a destination in their destination list only while it is Active.
        </Text>
      </Stack>
      <Toggle
        label="Publish on the public website"
        description="The website does not list the catalogue's destinations yet; this keeps the choice for when it does."
        value={draft.publicVisible}
        onValueChange={(publicVisible) => patch({ publicVisible })}
        testID="destination-public"
      />
    </Stack>
  );
}

/** Every field, in the field matrix's order: name, web address, place, description, visibility. */
function DestinationFields({ slug, ...props }: FieldsProps & { readonly slug: string | null }) {
  const { draft, patch, errors } = props;
  return (
    <Stack gap={4}>
      <Input
        label="Destination name"
        required
        value={draft.name}
        onChangeText={(name) => patch({ name })}
        errorText={errors.name}
        placeholder="e.g. Udaipur"
        autoCapitalize="words"
        testID="destination-name"
      />
      <SlugField slug={slug} {...props} />
      <PlaceFields {...props} />
      <Input
        label="Description"
        helpText="Client-facing: what makes the place right for a wedding, and its best months."
        value={draft.description}
        onChangeText={(description) => patch({ description })}
        errorText={errors.description}
        multiline
        testID="destination-description"
      />
      <VisibilityFields draft={draft} patch={patch} />
    </Stack>
  );
}

export interface DestinationEditSheetProps {
  readonly open: boolean;
  /** The destination being edited, or null to add a new one. */
  readonly destination: DestinationView | null;
  readonly onClose: () => void;
}

/**
 * Add a destination, or edit one (TW-20): its name, web address (set once), place, client-facing
 * description, status and whether it is published to the website. The server re-validates every field
 * and refuses a web address already in use. Hotel team and Super Admin only, gated server-side.
 *
 *   <DestinationEditSheet open={open} destination={editing} onClose={close} />
 */
export function DestinationEditSheet({ open, destination, onClose }: DestinationEditSheetProps) {
  const { draft, patch, errors, pending, submit } = useDestinationForm(open, destination, onClose);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={destination ? "Edit destination" : "New destination"}
      size="full"
      testID="destination-edit"
      footer={
        <Button fullWidth loading={pending} onPress={submit} testID="destination-edit-submit">
          {destination ? "Save changes" : "Add destination"}
        </Button>
      }
    >
      <DestinationFields
        slug={destination?.slug ?? null}
        draft={draft}
        patch={patch}
        errors={errors}
      />
    </Sheet>
  );
}
