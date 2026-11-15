import type { AccountContactView } from "@ampm/core";
import { Button, Card, ListItem, Row, Stack, StatusChip, Text } from "@ampm/ui";

function contactMeta(contact: AccountContactView): string {
  return [contact.relation, contact.phone, contact.email]
    .filter((v): v is string => Boolean(v))
    .join(" · ");
}

/** The contact's chips: a decision maker, and one who can sign in to the portal. */
function ContactChips({ contact }: { readonly contact: AccountContactView }) {
  if (!contact.isDecisionMaker && contact.userId === null) return null;
  return (
    <Stack gap={1} align="end">
      {contact.isDecisionMaker ? (
        <StatusChip label="Decision maker" tone="neutral" size="sm" />
      ) : null}
      {contact.userId !== null ? <StatusChip label="Portal access" tone="info" size="sm" /> : null}
    </Stack>
  );
}

/** The contacts in one card; a row opens the contact when the reader may edit it. */
function ContactList({
  contacts,
  onEdit,
}: {
  readonly contacts: readonly AccountContactView[];
  readonly onEdit: ((contact: AccountContactView) => void) | undefined;
}) {
  return (
    <Card padding="sm">
      <Stack gap={2}>
        {contacts.map((contact) => (
          <ListItem
            key={contact.id}
            title={contact.name}
            subtitle={contactMeta(contact)}
            trailing={<ContactChips contact={contact} />}
            onPress={onEdit ? () => onEdit(contact) : undefined}
            accessibilityLabel={onEdit ? `Edit ${contact.name}` : undefined}
            testID={`contact-${contact.id}`}
          />
        ))}
      </Stack>
    </Card>
  );
}

export interface AccountContactsProps {
  readonly contacts: readonly AccountContactView[];
  /** Opens a contact to edit; undefined for a reader who may not edit (the rows are read-only). */
  readonly onEdit: ((contact: AccountContactView) => void) | undefined;
  /** Opens the add-contact sheet; undefined for a reader who may not add. */
  readonly onAdd: (() => void) | undefined;
}

/**
 * The account's contacts (TW-13 Overview: family contacts with decision-maker flags and who has portal
 * access). A role that may edit opens a contact to change it, invite it or remove it; one that may add
 * gets Add contact beside the heading.
 */
export function AccountContacts({ contacts, onEdit, onAdd }: AccountContactsProps) {
  return (
    <Stack gap={2} testID="account-contacts">
      <Row gap={2} align="center" justify="between">
        <Text variant="heading">Contacts</Text>
        {onAdd ? (
          <Button
            variant="secondary"
            size="sm"
            icon="user-plus"
            onPress={onAdd}
            testID="contact-add"
          >
            Add contact
          </Button>
        ) : null}
      </Row>
      {contacts.length === 0 ? (
        <Text variant="bodySmall" tone="muted">
          No contacts yet.
        </Text>
      ) : (
        <ContactList contacts={contacts} onEdit={onEdit} />
      )}
    </Stack>
  );
}
