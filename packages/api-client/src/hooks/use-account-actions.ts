import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  accountContactInviteLink,
  accountContactRemovedResponse,
  accountContactResult,
  accountContactView,
  accountDetailView,
  type AccountContactCreateRequest,
  type AccountContactInviteLink,
  type AccountContactRemovedResponse,
  type AccountContactResult,
  type AccountContactUpdateRequest,
  type AccountContactView,
  type AccountDetailView,
  type AccountUpdateRequest,
} from "@ampm/core";

import { useApiClient } from "../provider";
import { ACCOUNTS_QUERY_KEY } from "./use-accounts";

/*
 * The client hub's writes (TW-13): the account's details and its contacts. Each refreshes every account
 * query (the list shows the name, the detail shows the contacts), and the server decides who may write
 * (`crm.accounts.*`: Super Admin and Sales).
 */

function useRefreshAccounts() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY });
}

/**
 * Edit the account's details (`PATCH /crm/accounts/:id`): name, couple names, preferred locations and
 * internal notes; null (or "") clears an optional one.
 *
 * @example
 * const update = useUpdateAccount(accountId);
 * update.mutate({ coupleNames: "Riya & Arjun" });
 */
export function useUpdateAccount(accountId: string) {
  const api = useApiClient();
  const refresh = useRefreshAccounts();
  return useMutation<AccountDetailView, Error, AccountUpdateRequest>({
    mutationFn: (body) =>
      api.request(`/crm/accounts/${accountId}`, {
        method: "PATCH",
        body,
        schema: accountDetailView,
      }),
    onSuccess: refresh,
  });
}

/**
 * Add a contact (`POST /crm/accounts/:id/contacts`); `invite: true` also creates their portal login and
 * sends the invite. `inviteQueued` false with a login means "created, re-send the invite".
 */
export function useAddAccountContact(accountId: string) {
  const api = useApiClient();
  const refresh = useRefreshAccounts();
  return useMutation<AccountContactResult, Error, AccountContactCreateRequest>({
    mutationFn: (body) =>
      api.request(`/crm/accounts/${accountId}/contacts`, {
        method: "POST",
        body,
        schema: accountContactResult,
      }),
    onSuccess: refresh,
  });
}

/** Edit a contact (`PATCH …/contacts/:contactId`); a portal user's email is refused (it signs in). */
export function useUpdateAccountContact(accountId: string, contactId: string) {
  const api = useApiClient();
  const refresh = useRefreshAccounts();
  return useMutation<AccountContactView, Error, AccountContactUpdateRequest>({
    mutationFn: (body) =>
      api.request(`/crm/accounts/${accountId}/contacts/${contactId}`, {
        method: "PATCH",
        body,
        schema: accountContactView,
      }),
    onSuccess: refresh,
  });
}

/** Remove a contact who has no portal login (`DELETE …/contacts/:contactId`; a soft delete). */
export function useRemoveAccountContact(accountId: string, contactId: string) {
  const api = useApiClient();
  const refresh = useRefreshAccounts();
  return useMutation<AccountContactRemovedResponse, Error, void>({
    mutationFn: () =>
      api.request(`/crm/accounts/${accountId}/contacts/${contactId}`, {
        method: "DELETE",
        schema: accountContactRemovedResponse,
      }),
    onSuccess: refresh,
  });
}

/** Give an existing contact a portal login and send the invite (`POST …/contacts/:contactId/invite`). */
export function useInviteAccountContact(accountId: string, contactId: string) {
  const api = useApiClient();
  const refresh = useRefreshAccounts();
  return useMutation<AccountContactResult, Error, void>({
    mutationFn: () =>
      api.request(`/crm/accounts/${accountId}/contacts/${contactId}/invite`, {
        method: "POST",
        schema: accountContactResult,
      }),
    onSuccess: refresh,
  });
}

/**
 * Test builds only: a fresh activation link for a contact whose login is still invited
 * (`POST …/contacts/:contactId/invite-link`), for staff to hand over where no email is delivered. The
 * API is a 404 outside a local, non-production build; each call retires the contact's earlier links.
 *
 * @example
 * const link = useAccountContactInviteLink(accountId, contactId);
 * link.mutate(undefined, { onSuccess: ({ activationUrl }) => show(activationUrl) });
 */
export function useAccountContactInviteLink(accountId: string, contactId: string) {
  const api = useApiClient();
  return useMutation<AccountContactInviteLink, Error, void>({
    mutationFn: () =>
      api.request(`/crm/accounts/${accountId}/contacts/${contactId}/invite-link`, {
        method: "POST",
        schema: accountContactInviteLink,
      }),
  });
}
