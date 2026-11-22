import { useState, type ReactNode } from "react";
import { useRouter } from "expo-router";
import type { UseQueryResult } from "@tanstack/react-query";

import { useAccount } from "@ampm/api-client";
import type { AccountContactView, AccountDetailView } from "@ampm/core";
import { Columns, InternalPanel, QueryErrorState, Screen, Skeleton, Stack, Text } from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { AccountAgreements } from "./account-agreements";
import { AccountContactSheet, type ContactTarget } from "./account-contact-sheet";
import { AccountContacts } from "./account-contacts";
import { AccountDetailsSheet } from "./account-details-sheet";
import { AccountEnquiries } from "./account-enquiries";
import { AccountCouple } from "./account-couple";
import { AccountFacts } from "./account-facts";
import { AccountHeader } from "./account-header";
import { AccountPayments } from "./account-payments";
import { AccountSavedHotels } from "./account-saved-hotels";
import { AccountSubscriptions } from "./account-subscriptions";
import { RecordPaymentSheet } from "./record-payment-sheet";
import { RemoveContactConfirm } from "./remove-contact-confirm";
import { useAccountPermissions, type AccountPermissions } from "./use-account-permissions";
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

/** What the hub's panels open; each is undefined for a reader who may not do it. */
interface HubActions {
  readonly onRecordPayment: ((subscriptionId: string) => void) | undefined;
  readonly onEditContact: ((contact: AccountContactView) => void) | undefined;
  readonly onAddContact: (() => void) | undefined;
}

interface ContentProps {
  readonly accountId: string;
  readonly account: AccountDetailView;
  readonly permissions: AccountPermissions;
  readonly actions: HubActions;
}

/**
 * The loaded account in T3's `1.3 : 1` columns from 1024. Main: the people and what they bought, saved
 * and asked for (contacts, subscriptions, saved hotels, hotel enquiries, service agreements). Side: the
 * couple (bride and groom with their fathers), the facts with the originating lead, the Finance ledger
 * and the internal notes, the reference panels a record keeps beside its working ones. Stacked, that is
 * the phone's order.
 */
function AccountDetailContent({ accountId, account, permissions, actions }: ContentProps) {
  return (
    <Columns ratios={[1.3, 1]} gap={6} align="start" testID="account-columns">
      <Stack key="main" gap={6}>
        <AccountContacts
          contacts={account.contacts}
          onEdit={actions.onEditContact}
          onAdd={actions.onAddContact}
        />
        <AccountSubscriptions accountId={accountId} onRecordPayment={actions.onRecordPayment} />
        <AccountSavedHotels accountId={accountId} canRead={permissions.canReadSavedHotels} />
        <AccountEnquiries accountId={accountId} canRead={permissions.canReadEnquiries} />
        <AccountAgreements accountId={accountId} canRead={permissions.canReadAgreements} />
      </Stack>
      <Stack key="side" gap={6}>
        <AccountCouple account={account} />
        <AccountFacts account={account} canOpenLead={permissions.canReadLeads} />
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
  readonly permissions: AccountPermissions;
  readonly actions: HubActions;
}

function AccountDetailBody({ accountId, account, permissions, actions }: BodyProps) {
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
      permissions={permissions}
      actions={actions}
    />
  );
}

/**
 * The hub's sheets and what each is open on. Held above the header and the columns, with the sheets
 * outside both: whichever opens one, and whatever width the window takes while it is open, the sheet
 * and its typed values stay. An edit sheet keeps the record as it was when opened, so a background
 * refresh never resets what is being typed.
 */
function useHubSheets() {
  const [payingSubscriptionId, setPayingSubscriptionId] = useState<string | null>(null);
  const [editingDetails, setEditingDetails] = useState<AccountDetailView | null>(null);
  const [contactTarget, setContactTarget] = useState<ContactTarget | null>(null);
  const [removing, setRemoving] = useState<AccountContactView | null>(null);
  return {
    payingSubscriptionId,
    setPayingSubscriptionId,
    editingDetails,
    setEditingDetails,
    contactTarget,
    setContactTarget,
    removing,
    askToRemove: (contact: AccountContactView): void => {
      setContactTarget(null);
      setRemoving(contact);
    },
    closeRemove: (): void => setRemoving(null),
  };
}

type HubSheets = ReturnType<typeof useHubSheets>;

function AccountHubSheets({
  accountId,
  account,
  permissions,
  sheets,
}: {
  readonly accountId: string;
  readonly account: AccountDetailView | undefined;
  readonly permissions: AccountPermissions;
  readonly sheets: HubSheets;
}) {
  const details = sheets.editingDetails ?? account;
  return (
    <>
      <RecordPaymentSheet
        subscriptionId={sheets.payingSubscriptionId}
        onClose={() => sheets.setPayingSubscriptionId(null)}
      />
      {details ? (
        <AccountDetailsSheet
          account={details}
          open={sheets.editingDetails !== null}
          onClose={() => sheets.setEditingDetails(null)}
        />
      ) : null}
      <AccountContactSheet
        accountId={accountId}
        target={sheets.contactTarget}
        permissions={permissions}
        onClose={() => sheets.setContactTarget(null)}
        onRemove={sheets.askToRemove}
      />
      <RemoveContactConfirm
        accountId={accountId}
        contact={sheets.removing}
        onClose={sheets.closeRemove}
      />
    </>
  );
}

export interface AccountDetailScreenProps {
  readonly accountId: string;
  readonly tabBar?: ReactNode;
}

/** The hub's actions for the reader: each opens its sheet, or is undefined when the role may not. */
function hubActions(
  sheets: HubSheets,
  permissions: AccountPermissions,
  canRecordPayment: boolean,
): HubActions {
  return {
    onRecordPayment: canRecordPayment ? sheets.setPayingSubscriptionId : undefined,
    onEditContact: permissions.canEdit
      ? (contact) => sheets.setContactTarget({ contact })
      : undefined,
    onAddContact: permissions.canAddContact ? () => sheets.setContactTarget({}) : undefined,
  };
}

/**
 * One client account, the hub for the client (TW-13): a header panel with its name, status and facts
 * (Edit details; Record payment while one subscription waits), then its contacts, subscriptions, saved
 * hotels, hotel enquiries and service agreements beside its details with the originating lead, payment ledger and
 * internal notes. Sales and the Super Admin keep the details and contacts up to date (add, edit, invite
 * to the portal, remove one without a login); every reader sees only what their role may, and the
 * server decides the same way.
 *
 *   <AccountDetailScreen accountId={id} tabBar={<AppTabBar />} />
 */
export function AccountDetailScreen({ accountId, tabBar }: AccountDetailScreenProps) {
  const router = useRouter();
  const account = useAccount(accountId);
  const pendingSubscriptionId = useSolePendingSubscription(accountId);
  const permissions = useAccountPermissions();
  const sheets = useHubSheets();
  const actions = hubActions(sheets, permissions, useCanRecordPayment());
  const editDetails = account.data ? () => sheets.setEditingDetails(account.data) : undefined;
  return (
    <Screen
      width="wide"
      tabBar={tabBar}
      header={
        <AccountHeader
          account={account.data}
          pendingSubscriptionId={pendingSubscriptionId}
          onRecordPayment={actions.onRecordPayment}
          onEditDetails={permissions.canEdit ? editDetails : undefined}
          onBack={() => router.back()}
        />
      }
    >
      <AccountDetailBody
        accountId={accountId}
        account={account}
        permissions={permissions}
        actions={actions}
      />
      <AccountHubSheets
        accountId={accountId}
        account={account.data}
        permissions={permissions}
        sheets={sheets}
      />
    </Screen>
  );
}
