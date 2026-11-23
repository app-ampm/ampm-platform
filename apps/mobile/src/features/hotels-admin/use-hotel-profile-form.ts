import { useEffect, useState } from "react";

import { useCreateHotel, useStaffDestinations, useUpdateHotel } from "@ampm/api-client";
import { isAppError, type HotelStaffListItem } from "@ampm/core";
import { useToast } from "@ampm/ui";

import type { ProfileFieldsProps, ProfilePatch } from "./hotel-profile.bindings";
import { blockedSaveToast, firstInvalidField, type ProfileFieldKey } from "./hotel-profile.errors";
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

/** What a save does once it lands or fails: a toast, and the sheet closes on success. */
function useSaveOutcome(isEdit: boolean, onClose: () => void) {
  const toast = useToast();
  return {
    onSuccess: (): void => {
      toast.show({ title: isEdit ? "Hotel updated" : "Hotel added", tone: "success" });
      onClose();
    },
    onError: (error: unknown): void =>
      void toast.show({
        title: isAppError(error) ? error.message : "Could not save the hotel",
        tone: "danger",
      }),
  };
}

export interface HotelProfileForm extends ProfileFieldsProps {
  readonly pending: boolean;
  readonly submit: () => void;
  readonly notesEditable: boolean;
}

/**
 * The profile editor's state, checks and save, kept out of the view so each stays small. The draft
 * re-seeds each time the sheet opens. A blocked save shows every error, names the first in a toast
 * (announced) and focuses it, since it may sit in a panel far below Save.
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
  const outcome = useSaveOutcome(hotel !== null, onClose);
  const focus = useFieldFocus<ProfileFieldKey>();
  const [draft, setDraft] = useState<HotelProfileDraft>(() => draftFromHotel(hotel));
  const [showErrors, setShowErrors] = useState(false);
  const country = useDestinationCountry(open, draft.destinationId);
  // Re-seed each time the sheet opens, so "New hotel" starts clean and editing shows current values.
  useEffect(() => {
    if (open) {
      setDraft(draftFromHotel(hotel));
      setShowErrors(false);
    }
  }, [open, hotel]);
  const pending = create.isPending || update.isPending;
  const patch: ProfilePatch = (next) => setDraft((prev) => ({ ...prev, ...next }));
  const submit = (): void => {
    if (pending) return;
    const checked = validateDraft(draft, country);
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
  const errors = showErrors ? validateDraft(draft, country) : {};
  return { draft, patch, errors, fieldRef: focus.fieldRef, pending, submit, notesEditable };
}
