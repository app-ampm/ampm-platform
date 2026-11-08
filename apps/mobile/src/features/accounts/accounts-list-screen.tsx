import type { ReactNode } from "react";
import { useRouter } from "expo-router";
import type { UseQueryResult } from "@tanstack/react-query";

import { useAccounts } from "@ampm/api-client";
import type { AccountPage } from "@ampm/core";
import { EmptyState, QueryErrorState, Screen, ScreenHeader, Skeleton, Stack } from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { AccountsList } from "./accounts-list";

/** "Clients · 12", with a "+" while more pages wait beyond the loaded one. */
function clientsEyebrow(page: AccountPage | undefined): string {
  if (!page) return "Clients";
  return `Clients · ${page.items.length}${page.nextCursor ? "+" : ""}`;
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

function AccountsBody({
  accounts,
  onOpen,
}: {
  readonly accounts: UseQueryResult<AccountPage>;
  readonly onOpen: (accountId: string) => void;
}) {
  const goToSignIn = useGoToSignIn();
  if (accounts.isPending) return <AccountsLoading />;
  if (accounts.isError) {
    return (
      <QueryErrorState
        error={accounts.error}
        onRetry={() => void accounts.refetch()}
        onSignIn={goToSignIn}
        signIn={{
          title: "Sign in to view clients",
          description: "Your session has ended. Sign in again to continue.",
        }}
      />
    );
  }
  if (accounts.data.items.length === 0) {
    return (
      <EmptyState
        icon="briefcase"
        title="No client accounts yet"
        description="Accounts appear here once Sales converts a lead into a client."
      />
    );
  }
  return <AccountsList accounts={accounts.data.items} onOpen={onOpen} />;
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
      tabBar={tabBar}
      header={
        <ScreenHeader
          eyebrow={clientsEyebrow(accounts.data)}
          title="Clients"
          onBack={() => router.back()}
        />
      }
    >
      <AccountsBody accounts={accounts} onOpen={openAccount} />
    </Screen>
  );
}
