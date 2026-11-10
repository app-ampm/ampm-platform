import { useQuery } from "@tanstack/react-query";
import {
  accountDetailView,
  accountPage,
  type AccountDetailView,
  type AccountListQuery,
  type AccountView,
} from "@ampm/core";

import { useApiClient } from "../provider";
import { useCursorList } from "./use-cursor-list";

/*
 * Client accounts (Module B CRM, feature 8.2). Staff read views (`crm.accounts.read`): the operational
 * account and its contacts. `internalNotes` is RESTRICTED-NOTES and billing is deferred — neither reaches
 * a client (the client account view is a separate, narrower model, unserved today).
 */

export const ACCOUNTS_QUERY_KEY = ["crm", "accounts"] as const;

/** The query key for one account's detail. */
export function accountQueryKey(accountId: string) {
  return [...ACCOUNTS_QUERY_KEY, accountId] as const;
}

function accountsPath(query: Partial<AccountListQuery>): string {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.q) params.set("q", query.q);
  if (query.cursor) params.set("cursor", query.cursor);
  params.set("limit", String(query.limit ?? 50));
  return `/crm/accounts?${params.toString()}`;
}

/** The client accounts list (`GET /crm/accounts`, `crm.accounts.read`), cursor-paginated by account id. */
export function useAccounts(query: Partial<AccountListQuery> = {}) {
  const api = useApiClient();
  return useCursorList<AccountView>([...ACCOUNTS_QUERY_KEY, query], (cursor, signal) =>
    api.get(accountsPath({ ...query, cursor }), accountPage, signal),
  );
}

/** One client account with its contacts (`GET /crm/accounts/:id`). */
export function useAccount(accountId: string) {
  const api = useApiClient();
  return useQuery<AccountDetailView>({
    queryKey: accountQueryKey(accountId),
    queryFn: ({ signal }) => api.get(`/crm/accounts/${accountId}`, accountDetailView, signal),
  });
}
