import type { AccountContactView } from "@ampm/core";
import { Button, Checkbox, Input, Sheet, Stack } from "@ampm/ui";

import type { ContactDraft, ContactErrors } from "./account-contact.form";
import { ContactAccess } from "./contact-access";
import type { AccountPermissions } from "./use-account-permissions";
import { useContactForm } from "./use-contact-form";

/** The sheet's target: a new contact (`contact` undefined) or the one being edited. */
export interface ContactTarget {
  readonly contact?: AccountContactView | undefined;
}

interface FieldsProps {
  readonly draft: ContactDraft;
  readonly patch: (next: Partial<ContactDraft>) => void;
  readonly errors: ContactErrors;
  /** The contact signs in with their email, so it is shown but not editable. */
  readonly emailLocked: boolean;
}

/** Who they are: the name and the relation to the couple. */
function ContactIdentityFields({ draft, patch, errors }: Omit<FieldsProps, "emailLocked">) {
  return (
    <>
      <Input
        label="Name"
        required
        value={draft.name}
        onChangeText={(name) => patch({ name })}
        maxLength={255}
        errorText={errors.name}
        testID="contact-name"
      />
      <Input
        label="Relation"
        required
        value={draft.relation}
        onChangeText={(relation) => patch({ relation })}
        helpText="Bride, groom, father of the bride…"
        maxLength={255}
        errorText={errors.relation}
        testID="contact-relation"
      />
    </>
  );
}

/** How to reach them, and whether they decide. */
function ContactReachFields({ draft, patch, errors, emailLocked }: FieldsProps) {
  return (
    <>
      <Input
        label="Email"
        value={draft.email}
        onChangeText={(email) => patch({ email })}
        disabled={emailLocked}
        helpText={emailLocked ? "They sign in with this email, so it stays as it is." : undefined}
        keyboardType="email-address"
        autoCapitalize="none"
        maxLength={255}
        errorText={errors.email}
        testID="contact-email"
      />
      <Input
        label="Phone"
        value={draft.phone}
        onChangeText={(phone) => patch({ phone })}
        helpText="An Indian number can be typed as its ten digits."
        keyboardType="phone-pad"
        errorText={errors.phone}
        testID="contact-phone"
      />
      <Checkbox
        label="Decision maker"
        checked={draft.isDecisionMaker}
        onCheckedChange={(isDecisionMaker) => patch({ isDecisionMaker })}
        testID="contact-decision-maker"
      />
    </>
  );
}

/** A new contact may be invited as it is added; an existing one shows its portal access. */
function InviteOrAccess({
  accountId,
  contact,
  permissions,
  invite,
  onInviteChange,
  onDone,
  onRemove,
}: {
  readonly accountId: string;
  readonly contact: AccountContactView | undefined;
  readonly permissions: AccountPermissions;
  readonly invite: boolean;
  readonly onInviteChange: (invite: boolean) => void;
  readonly onDone: () => void;
  readonly onRemove: (contact: AccountContactView) => void;
}) {
  if (!contact) {
    return (
      <Checkbox
        label="Send a portal invite"
        description="Creates their sign-in and emails them the invite."
        checked={invite}
        onCheckedChange={onInviteChange}
        testID="contact-invite"
      />
    );
  }
  return (
    <ContactAccess
      accountId={accountId}
      contact={contact}
      permissions={permissions}
      onDone={onDone}
      onRemove={() => onRemove(contact)}
    />
  );
}

export interface AccountContactSheetProps {
  readonly accountId: string;
  /** Null while the sheet is closed. */
  readonly target: ContactTarget | null;
  readonly permissions: AccountPermissions;
  readonly onClose: () => void;
  /** Asks to remove the contact (the screen confirms it); offered for a contact with no login. */
  readonly onRemove: (contact: AccountContactView) => void;
}

/**
 * Add a contact to a client account, or edit one (TW-13 Overview): name, relation, email, phone and
 * the decision-maker flag. Adding can send a portal invite at once; an existing contact without a
 * login can be invited or removed from here. A contact who signs in keeps their email (the API refuses
 * a change) and cannot be removed.
 */
export function AccountContactSheet(props: AccountContactSheetProps) {
  const { accountId, target, permissions, onClose, onRemove } = props;
  const contact = target?.contact;
  const form = useContactForm(accountId, contact, target !== null, onClose);
  const save = (
    <Button fullWidth loading={form.pending} onPress={form.submit} testID="contact-save">
      {contact ? "Save contact" : "Add contact"}
    </Button>
  );
  return (
    <Sheet
      open={target !== null}
      onClose={onClose}
      title={contact ? "Edit contact" : "Add contact"}
      testID="contact-sheet"
      footer={save}
    >
      <Stack gap={4}>
        <ContactIdentityFields draft={form.draft} patch={form.patch} errors={form.errors} />
        <ContactReachFields
          draft={form.draft}
          patch={form.patch}
          errors={form.errors}
          emailLocked={contact?.userId != null}
        />
        <InviteOrAccess
          accountId={accountId}
          contact={contact}
          permissions={permissions}
          invite={form.draft.invite}
          onInviteChange={(invite) => form.patch({ invite })}
          onDone={onClose}
          onRemove={onRemove}
        />
      </Stack>
    </Sheet>
  );
}
