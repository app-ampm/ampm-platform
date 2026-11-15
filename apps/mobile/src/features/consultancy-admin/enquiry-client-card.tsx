import { useRouter } from "expo-router";

import { useAccount } from "@ampm/api-client";
import type { AccountContactView, HotelEnquiryStaffDetailView } from "@ampm/core";
import { Avatar, Button, Card, Icon, Row, Stack, Text, type IconName } from "@ampm/ui";

import { useSectionCard } from "./use-section-card";

type Enquiry = Pick<
  HotelEnquiryStaffDetailView,
  "accountId" | "accountName" | "requestedByUserId" | "contactPreference"
>;

/** The person who sent the request: their own contact row, else the account's decision maker. */
export function requesterContact(
  contacts: readonly AccountContactView[],
  requestedByUserId: string,
): AccountContactView | undefined {
  return (
    contacts.find((contact) => contact.userId === requestedByUserId) ??
    contacts.find((contact) => contact.isDecisionMaker) ??
    contacts[0]
  );
}

/**
 * Who sent the enquiry, first on its overview: the client account's name and, from the account's
 * contacts, the person who asked — their relation, phone and email — with how they like to be reached
 * and a way into the account. The contacts are read through the staff account query; a role the CRM
 * refuses still sees the account's name, which the enquiry carries itself.
 */
export function EnquiryClientCard({ enquiry }: { readonly enquiry: Enquiry }) {
  const card = useSectionCard();
  const router = useRouter();
  const account = useAccount(enquiry.accountId);
  const contact = account.data
    ? requesterContact(account.data.contacts, enquiry.requestedByUserId)
    : undefined;
  const name = enquiry.accountName ?? account.data?.name ?? "Client account";
  const openAccount = (): void =>
    router.push({
      pathname: "/leads/accounts/[accountId]",
      params: { accountId: enquiry.accountId },
    });
  return (
    <Card tone={card.tone} className={card.className} testID="enquiry-client-card">
      <Stack gap={4}>
        <ClientIdentity name={name} coupleNames={account.data?.coupleNames ?? null} />
        {contact ? <ContactLines contact={contact} /> : null}
        {enquiry.contactPreference ? (
          <ContactLine icon="message" label="Prefers" value={enquiry.contactPreference} />
        ) : null}
        {account.isSuccess ? (
          <Row justify="start">
            <Button variant="secondary" size="sm" iconEnd="arrow-right" onPress={openAccount}>
              Open client account
            </Button>
          </Row>
        ) : null}
      </Stack>
    </Card>
  );
}

/** The account's name beside its initials, and the couple's names when the account has them. */
function ClientIdentity({
  name,
  coupleNames,
}: {
  readonly name: string;
  readonly coupleNames: string | null;
}) {
  return (
    <Row gap={3} align="center">
      <Avatar name={name} size="lg" tone="highlight" />
      <Stack gap={1} className="flex-1">
        <Text variant="eyebrow">Client</Text>
        <Text variant="subheading">{name}</Text>
        {coupleNames ? (
          <Text variant="bodySmall" tone="muted">
            {coupleNames}
          </Text>
        ) : null}
      </Stack>
    </Row>
  );
}

function ContactLines({ contact }: { readonly contact: AccountContactView }) {
  return (
    <Stack gap={2}>
      <ContactLine icon="user" label="Contact" value={`${contact.name} · ${contact.relation}`} />
      {contact.phone ? <ContactLine icon="phone" label="Phone" value={contact.phone} /> : null}
      {contact.email ? <ContactLine icon="mail" label="Email" value={contact.email} /> : null}
    </Stack>
  );
}

/** One way to reach the client: an icon, its name for screen readers, and the value to copy down. */
function ContactLine({
  icon,
  label,
  value,
}: {
  readonly icon: IconName;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <Row gap={3} align="center" accessible accessibilityLabel={`${label}: ${value}`}>
      <Icon name={icon} size="sm" tone="muted" />
      <Text variant="bodySmall" tone="muted" className="w-16">
        {label}
      </Text>
      <Text variant="bodySmall" tone="primary" className="flex-1" selectable>
        {value}
      </Text>
    </Row>
  );
}
