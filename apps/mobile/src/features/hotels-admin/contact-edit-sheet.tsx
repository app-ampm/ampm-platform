import type { HotelContactView } from "@ampm/core";
import { Button, Input, Sheet, Stack, Toggle } from "@ampm/ui";

import { phoneHint } from "./contacts.form";
import { InternalHint } from "./subresource-section";
import { useContactForm, type ContactForm } from "./use-contact-form";

/** The longest name, role, phone or email the contract takes. */
const TEXT_MAX = 255;

/** The phone, with the form a save keeps it in under it (E.164) or why it is refused, and the email. */
function ReachFields({ draft, patch, errors, phone }: ContactForm) {
  return (
    <>
      <Input
        label="Phone"
        value={draft.phone}
        onChangeText={(value) => patch({ phone: value })}
        helpText={phoneHint(phone)}
        errorText={errors.phone}
        keyboardType="phone-pad"
        maxLength={TEXT_MAX}
        testID="contact-phone"
      />
      <Input
        label="Email"
        value={draft.email}
        onChangeText={(email) => patch({ email })}
        keyboardType="email-address"
        autoCapitalize="none"
        errorText={errors.email}
        maxLength={TEXT_MAX}
        testID="contact-email"
      />
    </>
  );
}

/** The contact's fields, under the reminder that they never reach a client. */
function ContactFields(form: ContactForm) {
  const { draft, patch, errors } = form;
  return (
    <Stack gap={4}>
      <InternalHint text="Never shown to clients" testID="contact-edit-internal" />
      <Input
        label="Name"
        required
        value={draft.name}
        onChangeText={(name) => patch({ name })}
        errorText={errors.name}
        maxLength={TEXT_MAX}
        testID="contact-name"
      />
      <Input
        label="Role / title"
        value={draft.roleTitle}
        onChangeText={(roleTitle) => patch({ roleTitle })}
        maxLength={TEXT_MAX}
        placeholder="e.g. Events Manager"
        testID="contact-role"
      />
      <ReachFields {...form} />
      <Toggle
        label="Primary contact"
        description="Making this the primary contact replaces the current one"
        value={draft.isPrimary}
        onValueChange={(isPrimary) => patch({ isPrimary })}
        testID="contact-primary"
      />
    </Stack>
  );
}

export interface ContactEditSheetProps {
  readonly hotelId: string;
  readonly open: boolean;
  /** The contact being edited, or null to add a new one. */
  readonly contact: HotelContactView | null;
  readonly onClose: () => void;
}

/**
 * Add or edit a hotel contact (RESTRICTED-CONTACT — never shown to clients): name, role, phone, email
 * and whether it is the hotel's primary contact. The phone is saved in E.164, previewed as it is typed;
 * making a contact primary replaces the current one. Hotel team / Super Admin only, gated server-side.
 *
 *   <ContactEditSheet hotelId={hotelId} open={open} contact={editing} onClose={close} />
 */
export function ContactEditSheet({ hotelId, open, contact, onClose }: ContactEditSheetProps) {
  const form = useContactForm(hotelId, open, contact, onClose);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={contact ? "Edit contact" : "New contact"}
      size="full"
      testID="contact-edit"
      footer={
        <Button fullWidth loading={form.pending} onPress={form.submit} testID="contact-edit-submit">
          {contact ? "Save changes" : "Add contact"}
        </Button>
      }
    >
      <ContactFields {...form} />
    </Sheet>
  );
}
