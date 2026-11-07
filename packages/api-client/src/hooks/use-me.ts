import { queryOptions, useQuery } from "@tanstack/react-query";
import { meResponse } from "@ampm/core";

import type { ApiClient } from "../client";
import { useApiClient } from "../provider";

export const ME_QUERY_KEY = ["me"] as const;

export interface UseMeOptions {
  /**
   * False while nobody is signed in: `/me` could only answer 401, and would be asked again each time
   * the window regains focus. The query runs as soon as a render passes true. Defaults to true. Pass
   * state the component renders from (a store subscription), never a value read during render: the
   * React Compiler keeps such a read at its first value.
   */
  readonly enabled?: boolean | undefined;
}

/**
 * The `/me` query (its key, its fetch and whether it runs): what `useMe` hands to `useQuery`, and
 * what a prefetch outside a component reads.
 *
 *   await queryClient.prefetchQuery(meQueryOptions(api));
 */
export function meQueryOptions(api: ApiClient, { enabled = true }: UseMeOptions = {}) {
  return queryOptions({
    queryKey: ME_QUERY_KEY,
    queryFn: ({ signal }) => api.get("/me", meResponse, signal),
    enabled,
  });
}

/**
 * The signed-in principal from `GET /me`; the apps keep it as their session state. Pass
 * `{ enabled: false }` where the session may be missing (the navigation around the sign-in screen).
 *
 *   const me = useMe();
 *   const hasSession = useIsSignedIn(); // the app's session store, subscribed to
 *   const chromeMe = useMe({ enabled: hasSession });
 */
export function useMe(options: UseMeOptions = {}) {
  const api = useApiClient();
  return useQuery(meQueryOptions(api, options));
}
