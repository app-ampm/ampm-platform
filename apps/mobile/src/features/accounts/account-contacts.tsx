import type { AccountContactView } from "@ampm/core";
import { Card, Row, Stack, StatusChip, Text } from "@ampm/ui";

function contactMeta(contact: AccountContactView): string {
  return [contact.relation, contact.phone, contact.email]
    .filter((v): v is string => Boolean(v))
    .join(" · ");
}

/** The account's contacts (all CLIENT-class account_contacts fields); nothing when it has none. */
export function AccountContacts({
  contacts,
}: {
  readonly contacts: readonly AccountContactView[];
}) {
  if (contacts.length === 0) return null;
  return (
    <Stack gap={2} testID="account-contacts">
      <Text variant="heading">Contacts</Text>
      <Card padding="sm">
        <Stack gap={3}>
          {contacts.map((contact) => (
            <Row key={contact.id} gap={2} align="center" justify="between">
              <Stack gap={1} className="flex-1">
                <Text variant="body" numberOfLines={1}>
                  {contact.name}
                </Text>
                <Text variant="bodySmall" tone="muted" numberOfLines={1}>
                  {contactMeta(contact)}
                </Text>
              </Stack>
              {contact.isDecisionMaker ? (
                <StatusChip label="Decision maker" tone="neutral" size="sm" />
              ) : null}
            </Row>
          ))}
        </Stack>
      </Card>
    </Stack>
  );
}
