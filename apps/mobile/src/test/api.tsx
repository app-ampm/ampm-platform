import { QueryClient } from "@tanstack/react-query";
import type { ReactElement } from "react";

import { ApiProvider } from "@ampm/api-client";

import { renderWithProviders } from "./render";

/*
 * The API side of the screen tests, shared by every feature: the QueryClient, the render under an
 * `ApiProvider`, and responses in the API's envelope. Each feature keeps its own fixtures and fake
 * fetch (the routes it answers); test-only, never bundled.
 */

/** The base URL the screens under test call, and the fake fetches answer for. */
export const TEST_API_BASE = "http://api.test";

export interface TestQueryClientOptions {
  /** Infinity for a test that seeds the cache and must not refetch it (the navigation's /me). */
  readonly staleTime?: number | undefined;
}

/**
 * A QueryClient for one test: no retries, so error states settle at once; gcTime Infinity for queries
 * and mutations alike, so React Query schedules no cache-GC timer (five minutes by default) that would
 * keep Jest's event loop alive after the run.
 */
export function createTestQueryClient({ staleTime }: TestQueryClientOptions = {}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
        ...(staleTime === undefined ? {} : { staleTime }),
      },
      mutations: { gcTime: Infinity },
    },
  });
}

export interface RenderWithApiOptions {
  /** A client the test made (to seed or watch the cache); a fresh test client otherwise. */
  readonly queryClient?: QueryClient | undefined;
}

/**
 * Renders a screen under the app's providers and an `ApiProvider` that answers through `fetchImpl`,
 * and returns the QueryClient for a test that inspects the cache.
 *
 *   await renderWithApi(<HotelsScreen />, fakeApi(handler).fetch);
 */
export async function renderWithApi(
  ui: ReactElement,
  fetchImpl: typeof fetch,
  { queryClient = createTestQueryClient() }: RenderWithApiOptions = {},
): Promise<QueryClient> {
  await renderWithProviders(
    <ApiProvider baseUrl={TEST_API_BASE} fetch={fetchImpl} queryClient={queryClient}>
      {ui}
    </ApiProvider>,
  );
  return queryClient;
}

/** A JSON response from the fake API. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

/** A success in the API's envelope: `{ data }`. */
export function ok(data: unknown): Response {
  return jsonResponse({ data });
}

/** A failure in the API's envelope, its code doubling as the message. */
export function failure(code: string, status: number): Response {
  return jsonResponse({ error: { code, message: code } }, status);
}

/** A fetch that never answers: the screen stays loading. */
export const pendingFetch: typeof fetch = () => new Promise<Response>(() => {});

/** A fetch that cannot reach the API: the screen goes offline. */
export const offlineFetch: typeof fetch = () => Promise.reject(new Error("no network"));
