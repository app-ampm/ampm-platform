import type { ReactNode } from "react";
import { useRouter } from "expo-router";

import { useAccounts, type CursorListResult } from "@ampm/api-client";
import type { AccountView } from "@ampm/core";
import {
  EmptyState,
  LoadMore,
  QueryErrorState,
  Screen,
  ScreenHeader,
  Skeleton,
  Stack,
  useLayoutAt,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { AccountsList } from "./accounts-list";
import { AccountsTable } from "./accounts-table";

/** "Clients · 12", with a "+" while more pages wait beyond the loaded ones. */
function clientsEyebrow(accounts: CursorListResult<AccountView>): string {
  if (accounts.isPending) return "Clients";
  return `Clients · ${accounts.items.length}${accounts.hasMore ? "+" : ""}`;
}

function AccountsLoading() {
  return (
    <Stack gap={2} testID="accounts-loading">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </Stack>
  );
}

interface BodyProps {
  readonly accounts: CursorListResult<AccountView>;
  readonly onOpen: (accountId: string) => void;
}

/** The loaded accounts and the next-page footer. */
function AccountsLoaded({ accounts, onOpen }: BodyProps) {
  // A table from 768, phone rows below it. The loaded pages live in the query above the switch, so a
  // window crossing 768 shows the same accounts in the other form.
  const isTable = useLayoutAt("md");
  return (
    <Stack gap={4}>
      {isTable ? (
        <AccountsTable accounts={accounts.items} onOpen={onOpen} />
      ) : (
        <AccountsList accounts={accounts.items} onOpen={onOpen} />
      )}
      <LoadMore
        hasMore={accounts.hasMore}
        loading={accounts.isLoadingMore}
        failed={accounts.loadMoreError}
        onLoadMore={accounts.loadMore}
        testID="accounts-load-more"
      />
    </Stack>
  );
}

function AccountsBody({ accounts, onOpen }: BodyProps) {
  const goToSignIn = useGoToSignIn();
  if (accounts.isPending) return <AccountsLoading />;
  if (accounts.isError) {
    return (
      <QueryErrorState
        error={accounts.error}
        onRetry={accounts.refetch}
        onSignIn={goToSignIn}
        signIn={{
          title: "Sign in to view clients",
          description: "Your session has ended. Sign in again to continue.",
        }}
      />
    );
  }
  if (accounts.items.length === 0) {
    return (
      <EmptyState
        icon="briefcase"
        title="No client accounts yet"
        description="Accounts appear here once Sales converts a lead into a client."
      />
    );
  }
  return <AccountsLoaded accounts={accounts} onOpen={onOpen} />;
}

export interface AccountsListScreenProps {
  readonly tabBar?: ReactNode;
}

/**
 * The client accounts directory (the "Clients" half of Leads & Clients): every converted account, newest
 * first, opening the account's record with its contacts and subscriptions. Staff with CRM access read it;
 * the server refuses the rest. Reached from the leads workspace.
 *
 *   <AccountsListScreen tabBar={<AppTabBar />} />
 */
export function AccountsListScreen({ tabBar }: AccountsListScreenProps) {
  const router = useRouter();
  const accounts = useAccounts();
  const openAccount = (accountId: string): void =>
    router.push({ pathname: "/leads/accounts/[accountId]", params: { accountId } });
  return (
    <Screen
      width="wide"
      tabBar={tabBar}
      header={
        <ScreenHeader
          eyebrow={clientsEyebrow(accounts)}
          title="Clients"
          onBack={() => router.back()}
        />
      }
    >
      <AccountsBody accounts={accounts} onOpen={openAccount} />
    </Screen>
  );
}
