import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { isAppError } from "@ampm/core";

import { createApiClient, type ApiClient, type ApiClientOptions } from "./client";

const ApiContext = createContext<ApiClient | null>(null);

/** How a client made by {@link createQueryClient} retries. */
export interface QueryClientOptions {
  /**
   * Whether a query refused with 429 is tried again (default true). A page that counts the refusal's
   * Retry-After down itself (the hotel form) sets false, so no retry spends the window before it ends.
   */
  readonly retryRateLimited?: boolean;
}

const NEVER_RETRIED = ["unauthenticated", "forbidden", "not_found", "validation_failed"];

/**
 * Server state lives in TanStack Query (code.md); one client per app with sensible retries: a network or
 * server failure twice, never a denial or a validation failure.
 *
 * @example
 * const queryClient = createQueryClient({ retryRateLimited: false });
 */
export function createQueryClient(options: QueryClientOptions = {}): QueryClient {
  const isRetried = (error: Error): boolean => {
    if (!isAppError(error)) return true;
    if (error.code === "rate_limited") return options.retryRateLimited ?? true;
    return !NEVER_RETRIED.includes(error.code);
  };
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: (count, error) => isRetried(error) && count < 2 },
    },
  });
}

export interface ApiProviderProps extends ApiClientOptions {
  readonly children: ReactNode;
  readonly queryClient?: QueryClient | undefined;
}

export function ApiProvider({ children, queryClient, ...options }: ApiProviderProps) {
  const { baseUrl, getAccessToken, fetch: fetchImpl } = options;
  const client = useMemo(
    () => createApiClient({ baseUrl, getAccessToken, fetch: fetchImpl }),
    [baseUrl, getAccessToken, fetchImpl],
  );
  const queries = useMemo(() => queryClient ?? createQueryClient(), [queryClient]);
  return (
    <ApiContext.Provider value={client}>
      <QueryClientProvider client={queries}>{children}</QueryClientProvider>
    </ApiContext.Provider>
  );
}

export function useApiClient(): ApiClient {
  const client = useContext(ApiContext);
  if (!client) throw new Error("useApiClient() needs an <ApiProvider> above it");
  return client;
}
