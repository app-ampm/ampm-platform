import { useState, type ReactNode } from "react";
import { useRouter } from "expo-router";
import type { UseQueryResult } from "@tanstack/react-query";

import { useAccount } from "@ampm/api-client";
import type { AccountDetailView } from "@ampm/core";
import { Columns, InternalPanel, QueryErrorState, Screen, Skeleton, Stack, Text } from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { AccountContacts } from "./account-contacts";
import { AccountFacts } from "./account-facts";
import { AccountHeader } from "./account-header";
import { AccountPayments } from "./account-payments";
import { AccountSubscriptions } from "./account-subscriptions";
import { RecordPaymentSheet } from "./record-payment-sheet";
import { useCanRecordPayment } from "./use-can-record-payment";
import { useSolePendingSubscription } from "./use-pending-subscription";

function DetailLoading() {
  return (
    <Stack gap={4} testID="account-detail-loading">
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-20 w-full" />
    </Stack>
  );
}

interface ContentProps {
  readonly accountId: string;
  readonly account: AccountDetailView;
  /** Undefined for a reader who may not record a payment: no Record payment anywhere. */
  readonly onRecordPayment: ((subscriptionId: string) => void) | undefined;
}

/**
 * The loaded account in T3's `1.3 : 1` columns from 1024. Main: the people and what they bought
 * (contacts, subscriptions). Side: the facts, the Finance ledger and the internal notes, the reference
 * panels a record keeps beside its working ones. Stacked, that is the phone's order.
 */
function AccountDetailContent({ accountId, account, onRecordPayment }: ContentProps) {
  return (
    <Columns ratios={[1.3, 1]} gap={6} align="start" testID="account-columns">
      <Stack key="main" gap={6}>
        <AccountContacts contacts={account.contacts} />
        <AccountSubscriptions accountId={accountId} onRecordPayment={onRecordPayment} />
      </Stack>
      <Stack key="side" gap={6}>
        <AccountFacts account={account} />
        <AccountPayments accountId={accountId} />
        {account.internalNotes ? (
          <InternalPanel>
            <Text variant="body" tone="body">
              {account.internalNotes}
            </Text>
          </InternalPanel>
        ) : null}
      </Stack>
    </Columns>
  );
}

interface BodyProps {
  readonly accountId: string;
  readonly account: UseQueryResult<AccountDetailView>;
  readonly onRecordPayment: ((subscriptionId: string) => void) | undefined;
}

function AccountDetailBody({ accountId, account, onRecordPayment }: BodyProps) {
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
  return (
    <AccountDetailContent
      accountId={accountId}
      account={account.data}
      onRecordPayment={onRecordPayment}
    />
  );
}

export interface AccountDetailScreenProps {
  readonly accountId: string;
  readonly tabBar?: ReactNode;
}

/**
 * One client account (the "Clients" record): a header panel with its name, status and facts, then its
 * contacts and subscriptions beside its details, payment ledger and internal notes. A manual payment is
 * recorded against a pending subscription from the header (or the row, when several wait). Staff with
 * CRM access read it; only a role granting `crm.subscriptions.update` sees Record payment, and the
 * server enforces the same key.
 *
 *   <AccountDetailScreen accountId={id} tabBar={<AppTabBar />} />
 */
export function AccountDetailScreen({ accountId, tabBar }: AccountDetailScreenProps) {
  const router = useRouter();
  const account = useAccount(accountId);
  const pendingSubscriptionId = useSolePendingSubscription(accountId);
  const canRecordPayment = useCanRecordPayment();
  // Held here, above the header and the columns, and the sheet sits outside both: whichever opens it,
  // and whatever width the window takes while it is open, the sheet and its typed values stay.
  const [payingSubscriptionId, setPayingSubscriptionId] = useState<string | null>(null);
  const recordPayment = canRecordPayment ? setPayingSubscriptionId : undefined;
  return (
    <Screen
      width="wide"
      tabBar={tabBar}
      header={
        <AccountHeader
          account={account.data}
          pendingSubscriptionId={pendingSubscriptionId}
          onRecordPayment={recordPayment}
          onBack={() => router.back()}
        />
      }
    >
      <AccountDetailBody accountId={accountId} account={account} onRecordPayment={recordPayment} />
      <RecordPaymentSheet
        subscriptionId={payingSubscriptionId}
        onClose={() => setPayingSubscriptionId(null)}
      />
    </Screen>
  );
}
