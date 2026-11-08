import { focusManager, QueryClient, QueryObserver } from "@tanstack/react-query";
import type { MeResponse } from "@ampm/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../client";
import { ME_QUERY_KEY, meQueryOptions } from "./use-me";

const ME: MeResponse = {
  principal: {
    type: "staff",
    userId: "0192f3a0-7d3e-7b1a-9c2f-123456789abc",
    name: "Asha",
    email: null,
    phone: null,
    status: "active",
    lastLoginAt: null,
  },
  roles: ["SA"],
  memberships: [],
  entitlements: {
    modules: [],
    readOnlyModules: [],
    hotelReach: [],
    financeReach: [],
    requestTypes: { wedding: [], account: [] },
  },
  isDemo: false,
};

/** An API that answers every read with ME and records the paths it was asked for. */
function recordingApi(): { readonly api: ApiClient; readonly asked: string[] } {
  const asked: string[] = [];
  const api: ApiClient = {
    get: (path, schema) => {
      asked.push(path);
      return Promise.resolve(schema.parse(ME));
    },
    request: (path, { schema }) => {
      asked.push(path);
      return Promise.resolve(schema.parse(ME));
    },
    upload: (path, { schema }) => {
      asked.push(path);
      return Promise.resolve(schema.parse(ME));
    },
  };
  return { api, asked };
}

/**
 * A mounted client, so a regained window focus refetches as it does in the app; no retries, and no
 * garbage-collection timer left behind.
 */
function mountedClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  client.mount();
  return client;
}

/** The window loses and regains focus; the client reacts a tick later. */
async function regainFocus(): Promise<void> {
  focusManager.setFocused(false);
  focusManager.setFocused(true);
  await new Promise((resolve) => setTimeout(resolve, 0));
}

// useMe hands these options to useQuery, which drives a QueryObserver with them and passes each
// render's options to it again (setOptions): the tests drive that observer directly.
describe("meQueryOptions, the query behind useMe", () => {
  let client: QueryClient | undefined;

  afterEach(() => {
    client?.unmount();
    focusManager.setFocused(undefined);
  });

  it("asks for /me by default, and again when the window regains focus", async () => {
    const { api, asked } = recordingApi();
    client = mountedClient();
    const observer = new QueryObserver(client, meQueryOptions(api));
    const stop = observer.subscribe(() => {});
    await vi.waitFor(() => expect(observer.getCurrentResult().data).toEqual(ME));
    expect(meQueryOptions(api).queryKey).toEqual(ME_QUERY_KEY);
    await regainFocus();
    await vi.waitFor(() => expect(asked).toEqual(["/me", "/me"]));
    stop();
  });

  it("asks nothing while disabled, even on focus, and asks once a render enables it", async () => {
    const { api, asked } = recordingApi();
    client = mountedClient();
    const observer = new QueryObserver(client, meQueryOptions(api, { enabled: false }));
    const stop = observer.subscribe(() => {});
    await regainFocus();
    expect(asked).toEqual([]);
    expect(observer.getCurrentResult().fetchStatus).toBe("idle");
    // Signing in stores the token before navigating; the next render passes true.
    observer.setOptions(meQueryOptions(api, { enabled: true }));
    await vi.waitFor(() => expect(observer.getCurrentResult().data).toEqual(ME));
    expect(asked).toEqual(["/me"]);
    stop();
  });
});
