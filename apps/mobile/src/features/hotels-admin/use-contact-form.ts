import { useCreateContact, useUpdateContact } from "@ampm/api-client";
import type { HotelContactView } from "@ampm/core";

import {
  buildContactBody,
  contactUpdateBody,
  draftFromContact,
  phonePreview,
  validateContact,
  type ContactDraft,
  type ContactErrors,
  type PhonePreview,
} from "./contacts.form";
import { hasErrors } from "./hotel-form-fields";
import { useSaveOutcome, useSheetDraft } from "./use-sheet-form";

export interface ContactForm {
  readonly draft: ContactDraft;
  readonly patch: (next: Partial<ContactDraft>) => void;
  /** The errors on show: none until a save has been blocked by the checks. */
  readonly errors: Partial<ContactErrors>;
  /** The phone as a save keeps it, previewed as it is typed. */
  readonly phone: PhonePreview;
  readonly pending: boolean;
  readonly submit: () => void;
}

const MESSAGES = {
  added: "Contact added",
  updated: "Contact updated",
  failed: "Could not save the contact",
};

/**
 * The contact editor's state, checks and save (RESTRICTED-CONTACT). The phone's saved form is previewed
 * as it is typed and checked only when its text changed; an edit sends only what it changed (the phone
 * only when its text did), and one that changed nothing closes the sheet.
 *
 *   const form = useContactForm(hotelId, open, contact, onClose);
 */
export function useContactForm(
  hotelId: string,
  open: boolean,
  contact: HotelContactView | null,
  onClose: () => void,
): ContactForm {
  const create = useCreateContact(hotelId);
  const update = useUpdateContact(hotelId);
  const { draft, patch, showErrors, setShowErrors } = useSheetDraft(
    open,
    contact,
    draftFromContact,
  );
  const outcome = useSaveOutcome(MESSAGES, contact !== null, onClose);
  const pending = create.isPending || update.isPending;
  const submit = (): void => {
    if (pending) return;
    if (hasErrors(validateContact(draft, contact))) return setShowErrors(true);
    if (!contact) return create.mutate(buildContactBody(draft), outcome);
    const body = contactUpdateBody(draft, contact);
    if (Object.keys(body).length === 0) return onClose();
    update.mutate({ contactId: contact.id, body }, outcome);
  };
  const errors = showErrors ? validateContact(draft, contact) : {};
  return { draft, patch, errors, phone: phonePreview(draft, contact), pending, submit };
}
