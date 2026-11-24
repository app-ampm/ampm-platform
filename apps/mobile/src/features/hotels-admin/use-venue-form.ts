import type { RefCallback } from "react";

import { useCreateVenue, useUpdateVenue } from "@ampm/api-client";
import type { VenueView } from "@ampm/core";

import type { FieldNode } from "./use-field-focus";
import { useBlockedSave, useSaveOutcome, useSheetDraft } from "./use-sheet-form";
import {
  buildVenueBody,
  draftFromVenue,
  hasSetting,
  validateVenue,
  VENUE_FIELD_LABEL,
  VENUE_FIELD_ORDER,
  venueUpdateBody,
  type VenueDraft,
  type VenueField,
} from "./venues.form";

/** What each panel of the venue editor takes. */
export interface VenueFieldsProps {
  readonly draft: VenueDraft;
  readonly patch: (next: Partial<VenueDraft>) => void;
  /** The errors on show: none until a save has been blocked by the checks. */
  readonly errors: Partial<Record<VenueField, string | undefined>>;
  /** Whether a blocked save has put the checks' errors on show (the layout rows show theirs then). */
  readonly showErrors: boolean;
  readonly fieldRef: (key: VenueField) => RefCallback<FieldNode>;
}

/** A checked venue field held as free text in one box (not the setting, not the layout rows). */
export type VenueTextField = {
  [K in VenueField]: string extends VenueDraft[K] ? K : never;
}[VenueField];

/** A checked text box of the venue editor, to spread on its Input or AreaFields. */
export interface VenueFieldBinding {
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly errorText: string | undefined;
  readonly ref: RefCallback<FieldNode>;
}

/**
 * A checked field's value, setter, error on show and focus ref.
 *
 * @example
 * <Input label="Length (m)" {...venueField(props, "lengthM")} testID="venue-length" />
 */
export function venueField(props: VenueFieldsProps, key: VenueTextField): VenueFieldBinding {
  return {
    value: props.draft[key],
    onChangeText: (value) => props.patch({ [key]: value }),
    errorText: props.errors[key],
    ref: props.fieldRef(key),
  };
}

export interface VenueForm extends VenueFieldsProps {
  readonly pending: boolean;
  readonly submit: () => void;
}

const MESSAGES = {
  added: "Venue added",
  updated: "Venue updated",
  failed: "Could not save the venue",
};

/**
 * The venue editor's state, checks and save. A blocked save names the first field to fix and focuses
 * it; an edit sends only what it changed, and one that changed nothing closes the sheet.
 *
 *   const form = useVenueForm(hotelId, open, venue, onClose);
 */
export function useVenueForm(
  hotelId: string,
  open: boolean,
  venue: VenueView | null,
  onClose: () => void,
): VenueForm {
  const create = useCreateVenue(hotelId);
  const update = useUpdateVenue(hotelId);
  const { draft, patch, showErrors, setShowErrors } = useSheetDraft(open, venue, draftFromVenue);
  const checks = useBlockedSave(VENUE_FIELD_LABEL, VENUE_FIELD_ORDER);
  const outcome = useSaveOutcome(MESSAGES, venue !== null, onClose);
  const pending = create.isPending || update.isPending;
  const submit = (): void => {
    if (pending) return;
    if (checks.blocked(validateVenue(draft)) || !hasSetting(draft)) return setShowErrors(true);
    if (!venue) return create.mutate(buildVenueBody(draft), outcome);
    const body = venueUpdateBody(draft, venue);
    if (Object.keys(body).length === 0) return onClose();
    update.mutate({ venueId: venue.id, body }, outcome);
  };
  const errors = showErrors ? validateVenue(draft) : {};
  return { draft, patch, errors, showErrors, fieldRef: checks.fieldRef, pending, submit };
}
