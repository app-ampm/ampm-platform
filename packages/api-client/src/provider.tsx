import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { isAppError } from "@ampm/core";

import { createApiClient, type ApiClient, type ApiClientOptions } from "./client";

const ApiContext = createContext<ApiClient | null>(null);

/** Server state lives in TanStack Query (code.md); one client per app with sensible retries. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (count, error) => {
          // Never retry a denial or a validation failure; retry a network or server failure twice.
          if (
            isAppError(error) &&
            ["unauthenticated", "forbidden", "not_found", "validation_failed"].includes(error.code)
          )
            return false;
          return count < 2;
        },
      },
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
