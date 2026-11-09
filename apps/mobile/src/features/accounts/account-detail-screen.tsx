import { useState, type ReactNode } from "react";
import { useRouter } from "expo-router";
import type { UseQueryResult } from "@tanstack/react-query";

import { useAccount } from "@ampm/api-client";
import { formatDay, type AccountContactView, type AccountDetailView } from "@ampm/core";
import {
  Card,
  InternalPanel,
  QueryErrorState,
  Row,
  Screen,
  ScreenHeader,
  Skeleton,
  Stack,
  StatusChip,
  Text,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { AccountPayments } from "./account-payments";
import { AccountSubscriptions } from "./account-subscriptions";
import { accountStatusLabel, accountStatusTone } from "./accounts.format";
import { RecordPaymentSheet } from "./record-payment-sheet";

function DetailLoading() {
  return (
    <Stack gap={4} testID="account-detail-loading">
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-20 w-full" />
    </Stack>
  );
}

function FieldRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <Stack gap={1}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <Text variant="body">{value}</Text>
    </Stack>
  );
}

/** The account's name, status and basic wedding facts. */
function AccountOverview({ account }: { readonly account: AccountDetailView }) {
  return (
    <Card testID="account-overview">
      <Stack gap={3}>
        <Row gap={2} align="center" justify="between">
          <Text variant="heading" numberOfLines={1} className="flex-1">
            {account.name}
          </Text>
          <StatusChip
            label={accountStatusLabel(account.status)}
            tone={accountStatusTone(account.status)}
            size="sm"
          />
        </Row>
        {account.coupleNames ? <FieldRow label="Couple" value={account.coupleNames} /> : null}
        {account.preferredLocations ? (
          <FieldRow label="Preferred locations" value={account.preferredLocations} />
        ) : null}
        <Text
          variant="bodySmall"
          tone="muted"
        >{`Added ${formatDay(account.createdAt, { style: "data" })}`}</Text>
      </Stack>
    </Card>
  );
}

function contactMeta(contact: AccountContactView): string {
  return [contact.relation, contact.phone, contact.email]
    .filter((v): v is string => Boolean(v))
    .join(" · ");
}

/** The account's contacts (all CLIENT-class account_contacts fields). */
function AccountContacts({ contacts }: { readonly contacts: readonly AccountContactView[] }) {
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

/** The loaded account: overview, contacts, subscriptions (with the record-payment action) and notes. */
function AccountDetailContent({
  accountId,
  account,
}: {
  readonly accountId: string;
  readonly account: AccountDetailView;
}) {
  const [payingSubscriptionId, setPayingSubscriptionId] = useState<string | null>(null);
  return (
    <Stack gap={6}>
      <AccountOverview account={account} />
      <AccountContacts contacts={account.contacts} />
      <AccountSubscriptions accountId={accountId} onRecordPayment={setPayingSubscriptionId} />
      <AccountPayments accountId={accountId} />
      {account.internalNotes ? (
        <InternalPanel>
          <Text variant="body" tone="body">
            {account.internalNotes}
          </Text>
        </InternalPanel>
      ) : null}
      <RecordPaymentSheet
        subscriptionId={payingSubscriptionId}
        onClose={() => setPayingSubscriptionId(null)}
      />
    </Stack>
  );
}

function AccountDetailBody({
  accountId,
  account,
}: {
  readonly accountId: string;
  readonly account: UseQueryResult<AccountDetailView>;
}) {
  const goToSignIn = useGoToSignIn();
  if (account.isPending) return <DetailLoading />;
  if (account.isError) {
    return (
      <QueryErrorState
        error={account.error}
        onRetry={() => void account.refetch()}
        onSignIn={goToSignIn}
        signIn={{
          title: "Sign in to view this client",
          description: "Your session has ended. Sign in again to continue.",
        }}
        notFound={{ title: "Client not found", description: "It may have been removed." }}
      />
    );
  }
  return <AccountDetailContent accountId={accountId} account={account.data} />;
}

export interface AccountDetailScreenProps {
  readonly accountId: string;
  readonly tabBar?: ReactNode;
}

/**
 * One client account (the "Clients" record): its wedding facts, contacts, subscriptions and internal
 * notes, where Finance records a manual payment against a pending subscription. Staff with CRM access
 * read it; recording a payment is Finance / Super Admin, gated server-side.
 *
 *   <AccountDetailScreen accountId={id} tabBar={<AppTabBar />} />
 */
export function AccountDetailScreen({ accountId, tabBar }: AccountDetailScreenProps) {
  const router = useRouter();
  const account = useAccount(accountId);
  return (
    <Screen
      width="wide"
      tabBar={tabBar}
      header={
        <ScreenHeader
          eyebrow="Client"
          title={account.data?.name ?? "Client"}
          onBack={() => router.back()}
        />
      }
    >
      <AccountDetailBody accountId={accountId} account={account} />
    </Screen>
  );
}
