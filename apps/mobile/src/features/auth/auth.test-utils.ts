import type { SignInGrant } from "@ampm/core";

import { jsonResponse, TEST_API_BASE } from "../../test/api";

export { createTestQueryClient, ok, renderWithApi } from "../../test/api";

/*
 * Test helpers for AMPM's own client sign-in and activation (D-147): a granted session and a fetch that
 * answers the auth routes by path, recording what was sent. Imported by tests only.
 */

/** A session as the sign-in endpoints grant it. */
export const GRANT: SignInGrant = {
  accessToken: "client-token",
  user: {
    id: "018f0000-0000-7000-8000-00000000c1e1",
    name: "Cara Client",
    email: "cara@example.com",
  },
};

/** A refusal in the API's envelope, carrying the message the screen shows. */
export function refused(code: string, message: string, status: number): Response {
  return jsonResponse({ error: { code, message } }, status);
}

/** An answer now, or a promise that never settles for a request still on its way. */
type Route = (body: unknown) => Response | Promise<Response>;

/** A request that never answers: the action that sent it stays busy. */
export const neverAnswers = (): Promise<Response> => new Promise<Response>(() => undefined);

export interface RecordedCall {
  readonly path: string;
  readonly body: unknown;
}

/** A fetch that answers by path and records each call's path and JSON body; other paths are 404s. */
export function authFetch(routes: Readonly<Record<string, Route>>) {
  const calls: RecordedCall[] = [];
  const fetchImpl: typeof fetch = (input, init) => {
    const path = String(input).replace(TEST_API_BASE, "");
    const body: unknown = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ path, body });
    const route = routes[path];
    return Promise.resolve(route ? route(body) : refused("not_found", "Not found", 404));
  };
  return { fetch: fetchImpl, calls };
}
