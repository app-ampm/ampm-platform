import { useInfiniteQuery } from "@tanstack/react-query";

/** One page of a cursor-paginated list: its items and the cursor for the next page (null at the end). */
export interface CursorPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

/** Options shared by the cursor-list hooks. */
export interface CursorListOptions {
  /** False disables the query (e.g. a role that may not read the list), like `useQuery`'s `enabled`. */
  readonly enabled?: boolean | undefined;
}

/** A cursor-paginated list flattened for the UI: the loaded items plus the load-more affordances. */
export interface CursorListResult<T> {
  readonly items: readonly T[];
  readonly isPending: boolean;
  /** The **first** page failed to load (nothing is on screen) — show the full error state. */
  readonly isError: boolean;
  readonly error: Error | null;
  readonly refetch: () => void;
  /** Another page is available beyond the loaded ones. */
  readonly hasMore: boolean;
  /** Fetch and append the next page. */
  readonly loadMore: () => void;
  /** The next page is loading. */
  readonly isLoadingMore: boolean;
  /** A **load-more** attempt failed while loaded pages are still shown — surface a retry on the footer. */
  readonly loadMoreError: boolean;
}

/**
 * A cursor-paginated list backed by `useInfiniteQuery`: it keeps the loaded pages, flattens their items,
 * and exposes `hasMore` / `loadMore` / `isLoadingMore` for a "Load more" footer. The CRM list hooks
 * (`useLeads`, `useAccounts`, `usePayments`) delegate here so every list paginates the same way. Invalidating
 * the query key refetches the loaded pages in place (the mutations keep using the same prefix).
 *
 *   const leads = useCursorList<LeadView>(
 *     [...LEADS_QUERY_KEY, query],
 *     (cursor, signal) => api.get(leadsPath({ ...query, cursor }), leadPage, signal),
 *   );
 */
export function useCursorList<T>(
  queryKey: readonly unknown[],
  fetchPage: (cursor: string | undefined, signal: AbortSignal) => Promise<CursorPage<T>>,
  options: CursorListOptions = {},
): CursorListResult<T> {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam, signal }) => fetchPage(pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: options.enabled ?? true,
  });
  const pages = query.data?.pages ?? [];
  return {
    items: pages.flatMap((page) => page.items),
    isPending: query.isPending,
    // Only the initial load failing (no page loaded) is a full-list error. A failed `fetchNextPage`
    // keeps the loaded pages in `data` and merely flips `isError`, so passing that through would wipe a
    // list that is already on screen — it is surfaced as `loadMoreError` on the footer instead.
    isError: query.isLoadingError,
    error: query.error,
    refetch: () => void query.refetch(),
    hasMore: query.hasNextPage,
    loadMore: () => void query.fetchNextPage(),
    isLoadingMore: query.isFetchingNextPage,
    loadMoreError: query.isFetchNextPageError,
  };
}
