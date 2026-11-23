import { useEffect, useState } from "react";

import { useCreateHotel, useStaffDestinations, useUpdateHotel } from "@ampm/api-client";
import { isAppError, type HotelStaffListItem } from "@ampm/core";
import { useToast, type ToastOptions } from "@ampm/ui";

import type { ProfileFieldsProps, ProfilePatch } from "./hotel-profile.bindings";
import {
  blockedSaveToast,
  errorsOnShow,
  firstInvalidField,
  placeServerErrors,
  withoutEdited,
  type ProfileFieldErrors,
  type ProfileFieldKey,
} from "./hotel-profile.errors";
import {
  buildHotelBody,
  draftFromHotel,
  hasInternalNotes,
  internalNotesBody,
  validateDraft,
  type HotelProfileDraft,
} from "./hotel-profile.form";
import { useFieldFocus } from "./use-field-focus";
import { useHotelProfilePermissions } from "./use-hotel-profile-permissions";

/**
 * Whether this person edits the internal rating and notes here: they may set them, and, editing, the
 * hotel carries them (only a reader of them gets them). Otherwise the fields stay out of the form and
 * of the body, so a save leaves them as they are (D-171).
 */
function useNotesEditable(hotel: HotelStaffListItem | null): boolean {
  const { canEditNotes } = useHotelProfilePermissions();
  return canEditNotes && (hotel === null || hasInternalNotes(hotel));
}

/**
 * The chosen destination's country, for the PIN rule: read from the destination list the picker loads
 * while the sheet is open (one request). Null while unknown, and the server then decides.
 */
function useDestinationCountry(open: boolean, destinationId: string): string | null {
  const destinations = useStaffDestinations({ enabled: open });
  return destinations.data?.find((item) => item.id === destinationId)?.country ?? null;
}

/** The toast for a save that failed for any other reason than fields the editor can show. */
function failedSaveToast(error: unknown): ToastOptions {
  return { title: isAppError(error) ? error.message : "Could not save the hotel", tone: "danger" };
}

/** Where a refused save's field errors go: on show under their fields, and focus to the first. */
interface RefusedFields {
  readonly show: (errors: ProfileFieldErrors) => void;
  readonly focus: (key: ProfileFieldKey) => void;
}

/**
 * What a save does once it lands or fails: a toast, and the sheet closes on success. A save the server
 * refuses as invalid puts each error under the field its path names, focuses the first and names it in
 * the toast, as a blocked save does; a refusal naming anything the editor has no field for, and any
 * other failure, keeps the plain toast.
 */
function useSaveOutcome(isEdit: boolean, onClose: () => void, refused: RefusedFields) {
  const toast = useToast();
  return {
    onSuccess: (): void => {
      toast.show({ title: isEdit ? "Hotel updated" : "Hotel added", tone: "success" });
      onClose();
    },
    onError: (error: unknown): void => {
      if (!isAppError(error) || error.code !== "validation_failed") {
        toast.show(failedSaveToast(error));
        return;
      }
      const { fields, unplaced } = placeServerErrors(error.details ?? []);
      const first = firstInvalidField(fields);
      refused.show(fields);
      toast.show(
        first && !unplaced ? blockedSaveToast(first, fields[first] ?? "") : failedSaveToast(error),
      );
      if (first) refused.focus(first);
    },
  };
}

/**
 * The draft and the errors a save left on it: whether the checks' errors are on show, and the fields the
 * server refused. Editing a field drops its refusal until the next save; opening the sheet starts clean.
 */
function useProfileDraft(open: boolean, hotel: HotelStaffListItem | null) {
  const [draft, setDraft] = useState<HotelProfileDraft>(() => draftFromHotel(hotel));
  const [showErrors, setShowErrors] = useState(false);
  const [refused, setRefused] = useState<ProfileFieldErrors>({});
  // Re-seed each time the sheet opens, so "New hotel" starts clean and editing shows current values.
  useEffect(() => {
    if (open) {
      setDraft(draftFromHotel(hotel));
      setShowErrors(false);
      setRefused({});
    }
  }, [open, hotel]);
  const patch: ProfilePatch = (next) => {
    setDraft((prev) => ({ ...prev, ...next }));
    setRefused((prev) => withoutEdited(prev, Object.keys(next)));
  };
  return { draft, patch, showErrors, setShowErrors, refused, setRefused };
}

export interface HotelProfileForm extends ProfileFieldsProps {
  readonly pending: boolean;
  readonly submit: () => void;
  readonly notesEditable: boolean;
}

/**
 * The profile editor's state, checks and save, kept out of the view so each stays small. The draft
 * re-seeds each time the sheet opens. A blocked save shows every error, names the first in a toast
 * (announced) and focuses it, since it may sit in a panel far below Save; a save the server refuses on
 * the editor's fields does the same with the server's errors.
 *
 *   const form = useHotelProfileForm(open, hotel, onClose);
 */
export function useHotelProfileForm(
  open: boolean,
  hotel: HotelStaffListItem | null,
  onClose: () => void,
): HotelProfileForm {
  const toast = useToast();
  const create = useCreateHotel();
  const update = useUpdateHotel();
  const notesEditable = useNotesEditable(hotel);
  const focus = useFieldFocus<ProfileFieldKey>();
  const { draft, patch, showErrors, setShowErrors, refused, setRefused } = useProfileDraft(
    open,
    hotel,
  );
  const outcome = useSaveOutcome(hotel !== null, onClose, {
    show: setRefused,
    focus: focus.focusField,
  });
  const country = useDestinationCountry(open, draft.destinationId);
  const pending = create.isPending || update.isPending;
  const submit = (): void => {
    if (pending) return;
    const checked: ProfileFieldErrors = validateDraft(draft, country);
    const first = firstInvalidField(checked);
    if (first) {
      setShowErrors(true);
      toast.show(blockedSaveToast(first, checked[first] ?? ""));
      return focus.focusField(first);
    }
    const profile = buildHotelBody(draft);
    const body = notesEditable ? { ...profile, ...internalNotesBody(draft) } : profile;
    if (hotel) update.mutate({ hotelId: hotel.id, body }, outcome);
    else create.mutate(body, outcome);
  };
  const errors = errorsOnShow(showErrors ? validateDraft(draft, country) : {}, refused);
  return { draft, patch, errors, fieldRef: focus.fieldRef, pending, submit, notesEditable };
}
