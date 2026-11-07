import { useSyncExternalStore } from "react";

import { env } from "./env";

/**
 * The access token sent as the Bearer on every API request. A development build is seeded from the
 * local env token (if set) for convenience; the dev sign-in screen sets it at runtime via a local
 * `/auth/dev-login`. Production builds never carry a local token — `__DEV__` is false there, so the
 * minifier drops the env read, and the API refuses local tokens anyway (security.md). The token is
 * held in memory only (not persisted), so a reload resets it to this seeded default.
 */
let currentToken: string | null = __DEV__ ? (env.EXPO_PUBLIC_DEV_ACCESS_TOKEN ?? null) : null;

/** The components rendering from the session (`useIsSignedIn`), told each time the token changes. */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function isSignedIn(): boolean {
  return currentToken !== null;
}

/** The token the typed client attaches to each request (via `getAccessToken` on the ApiProvider). */
export function getAccessToken(): string | null {
  return currentToken;
}

/**
 * Store the token after a dev sign-in, or clear it (pass `null`) on sign-out or when the API refuses
 * it; the components reading `useIsSignedIn` render again.
 */
export function setAccessToken(token: string | null): void {
  currentToken = token;
  for (const listener of listeners) listener();
}

/**
 * Whether a token is held, for a component that renders from it: the entry route sends a visitor to
 * sign-in or the workspace, and the navigation asks `/me` only with a session. A subscription, never
 * a read of the token during render: the React Compiler (app.json) keeps such a read at its first
 * value for the component's life, and nothing would render the component again when signing in or
 * out changes it.
 *
 *   const hasSession = useIsSignedIn();
 *   const me = useMe({ enabled: hasSession });
 */
export function useIsSignedIn(): boolean {
  return useSyncExternalStore(subscribe, isSignedIn, isSignedIn);
}
