import { useEffect, useState } from "react";

import { useAddAccountContact, useUpdateAccountContact } from "@ampm/api-client";
import { isAppError, type AccountContactResult, type AccountContactView } from "@ampm/core";
import { useToast } from "@ampm/ui";

import {
  buildContactCreate,
  buildContactUpdate,
  contactDraftOf,
  type ContactDraft,
  type ContactErrors,
  type ContactField,
} from "./account-contact.form";

const FIELDS: readonly ContactField[] = ["name", "relation", "email", "phone"];

/** A refused save's field messages (the API's validation details), so they sit under their field. */
function serverErrorsOf(error: unknown): ContactErrors | null {
  if (!isAppError(error) || error.code !== "validation_failed") return null;
  const errors: Partial<Record<ContactField, string>> = {};
  for (const detail of error.details ?? []) {
    const field = FIELDS.find((name) => name === detail.path);
    if (field) errors[field] = detail.message;
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

/** What the add toast says: whether the invite asked for went out. */
function addedTitle(result: AccountContactResult, invited: boolean): string {
  if (!invited) return "Contact added";
  return result.inviteQueued
    ? "Contact added and invited"
    : "Contact added. The invite was not sent; send it again from the contact.";
}

type SetErrors = (errors: ContactErrors) => void;

/** Saves the draft: an add, or an edit sending only what changed (nothing changed just closes). */
function useContactSave(
  accountId: string,
  contact: AccountContactView | undefined,
  onClose: () => void,
  setErrors: SetErrors,
) {
  const toast = useToast();
  const add = useAddAccountContact(accountId);
  const update = useUpdateAccountContact(accountId, contact?.id ?? "");
  const done = (title: string): void => {
    toast.show({ title, tone: "success" });
    onClose();
  };
  const onError = (error: unknown): void => {
    const fieldErrors = serverErrorsOf(error);
    if (fieldErrors) return setErrors(fieldErrors);
    const title = isAppError(error) ? error.message : "Could not save the contact";
    toast.show({ title, tone: "danger" });
  };
  const save = (draft: ContactDraft): void => {
    if (!contact) {
      const built = buildContactCreate(draft);
      if (!built.ok) return setErrors(built.errors);
      const invited = built.body.invite;
      return add.mutate(built.body, { onSuccess: (r) => done(addedTitle(r, invited)), onError });
    }
    const built = buildContactUpdate(draft, contact);
    if (!built.ok) return setErrors(built.errors);
    if (built.body === null) return onClose();
    update.mutate(built.body, { onSuccess: () => done("Contact saved"), onError });
  };
  return { save, pending: add.isPending || update.isPending };
}

/**
 * The contact sheet's draft, validation and save: an add (`contact` undefined) or an edit. Field
 * errors show once a save is tried, and a refusal the API explains per field lands under that field.
 *
 *   const form = useContactForm(accountId, contact, open, onClose);
 */
export function useContactForm(
  accountId: string,
  contact: AccountContactView | undefined,
  open: boolean,
  onClose: () => void,
) {
  const [draft, setDraft] = useState<ContactDraft>(() => contactDraftOf(contact));
  const [errors, setErrors] = useState<ContactErrors>({});
  const { save, pending } = useContactSave(accountId, contact, onClose, setErrors);
  useEffect(() => {
    if (!open) return;
    setDraft(contactDraftOf(contact));
    setErrors({});
  }, [open, contact]);
  const patch = (next: Partial<ContactDraft>): void => setDraft((prev) => ({ ...prev, ...next }));
  const submit = (): void => {
    if (!pending) save(draft);
  };
  return { draft, patch, errors, pending, submit };
}
