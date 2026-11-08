import { useEffect, useState } from "react";

import { useCreateContact, useUpdateContact } from "@ampm/api-client";
import { isAppError, type HotelContactView } from "@ampm/core";
import { Button, Input, Sheet, Stack, Toggle, useToast } from "@ampm/ui";

import { hasErrors } from "./hotel-form-fields";
import { InternalHint } from "./subresource-section";
import {
  buildContactBody,
  draftFromContact,
  validateContact,
  type ContactDraft,
  type ContactErrors,
} from "./subresources.form";

const NO_ERRORS: ContactErrors = { name: undefined, email: undefined };

/** The contact create/edit form's state, validation and submission. */
function useContactForm(
  hotelId: string,
  open: boolean,
  contact: HotelContactView | null,
  onClose: () => void,
) {
  const toast = useToast();
  const create = useCreateContact(hotelId);
  const update = useUpdateContact(hotelId);
  const [draft, setDraft] = useState<ContactDraft>(() => draftFromContact(contact));
  const [showErrors, setShowErrors] = useState(false);
  useEffect(() => {
    if (open) {
      setDraft(draftFromContact(contact));
      setShowErrors(false);
    }
  }, [open, contact]);
  const pending = create.isPending || update.isPending;
  const onError = (error: unknown): void =>
    void toast.show({
      title: isAppError(error) ? error.message : "Could not save the contact",
      tone: "danger",
    });
  const onSuccess = (): void => {
    toast.show({ title: contact ? "Contact updated" : "Contact added", tone: "success" });
    onClose();
  };
  const patch = (next: Partial<ContactDraft>): void => setDraft((prev) => ({ ...prev, ...next }));
  const submit = (): void => {
    if (pending) return;
    if (hasErrors(validateContact(draft))) return setShowErrors(true);
    const body = buildContactBody(draft);
    if (contact) update.mutate({ contactId: contact.id, body }, { onSuccess, onError });
    else create.mutate(body, { onSuccess, onError });
  };
  return { draft, patch, errors: showErrors ? validateContact(draft) : NO_ERRORS, pending, submit };
}

export interface ContactEditSheetProps {
  readonly hotelId: string;
  readonly open: boolean;
  /** The contact being edited, or null to add a new one. */
  readonly contact: HotelContactView | null;
  readonly onClose: () => void;
}

/**
 * Add or edit a hotel contact (RESTRICTED-CONTACT — never shown to clients). Name, role, phone, email
 * and whether it is the primary contact. Hotel team / Super Admin only, gated server-side.
 */
export function ContactEditSheet({ hotelId, open, contact, onClose }: ContactEditSheetProps) {
  const { draft, patch, errors, pending, submit } = useContactForm(hotelId, open, contact, onClose);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={contact ? "Edit contact" : "New contact"}
      size="full"
      testID="contact-edit"
      footer={
        <Button fullWidth loading={pending} onPress={submit} testID="contact-edit-submit">
          {contact ? "Save changes" : "Add contact"}
        </Button>
      }
    >
      <Stack gap={4}>
        <InternalHint text="Never shown to clients" testID="contact-edit-internal" />
        <Input
          label="Name"
          required
          value={draft.name}
          onChangeText={(name) => patch({ name })}
          errorText={errors.name}
          testID="contact-name"
        />
        <Input
          label="Role / title"
          value={draft.roleTitle}
          onChangeText={(roleTitle) => patch({ roleTitle })}
          placeholder="e.g. Events Manager"
          testID="contact-role"
        />
        <Input
          label="Phone"
          value={draft.phone}
          onChangeText={(phone) => patch({ phone })}
          keyboardType="phone-pad"
          testID="contact-phone"
        />
        <Input
          label="Email"
          value={draft.email}
          onChangeText={(email) => patch({ email })}
          keyboardType="email-address"
          autoCapitalize="none"
          errorText={errors.email}
          testID="contact-email"
        />
        <Toggle
          label="Primary contact"
          value={draft.isPrimary}
          onValueChange={(isPrimary) => patch({ isPrimary })}
          testID="contact-primary"
        />
      </Stack>
    </Sheet>
  );
}
