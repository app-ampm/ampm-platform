import { useSyncExternalStore } from "react";

import { env } from "./env";

/** Who signs people in, fixed at build time. Either way the API mints the token and it is held here. */
const provider = env.EXPO_PUBLIC_IDENTITY_PROVIDER;

/**
 * The access token sent as the Bearer on every API request, and the signed-in flag the entry gate and
 * navigation read:
 *
 * - `local` (dev-login): an in-memory token the dev sign-in screen sets. A development build seeds it from
 *   the env token; production never carries one (`__DEV__` is false, so the minifier drops the read, and
 *   the API refuses local tokens anyway — security.md).
 * - `ampm` (AMPM's own sign-in, D-142): the token the API minted after the password and the
 *   authenticator code, held the same way under its own storage key, never seeded from the env.
 */
let localToken: string | null =
  provider === "local" && __DEV__ ? (env.EXPO_PUBLIC_DEV_ACCESS_TOKEN ?? null) : null;

/** The components rendering from the session (`useIsSignedIn`), told each time it changes. */
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function isSignedIn(): boolean {
  return localToken !== null;
}

/** The token the typed client attaches to each request (via `getAccessToken` on the ApiProvider). */
export function getAccessToken(): string | null {
  return localToken;
}

/**
 * Where the token is persisted on the web so a refresh keeps the session. Each provider has its own key,
 * so a stale dev-login token can never be sent as the session of an AMPM sign-in build, or the reverse.
 */
const DEV_TOKEN_KEY = provider === "ampm" ? "ampm.accessToken" : "ampm.devToken";

/** The persisted dev token, or null — web localStorage only, guarded for SSR / native / private mode. */
function readPersistedToken(): string | null {
  try {
    return globalThis.localStorage?.getItem(DEV_TOKEN_KEY) ?? null;
  } catch {
    return null;
  }
}

function persistToken(token: string | null): void {
  try {
    const store = globalThis.localStorage;
    if (!store) return;
    if (token === null) store.removeItem(DEV_TOKEN_KEY);
    else store.setItem(DEV_TOKEN_KEY, token);
  } catch {
    // Private mode or no storage: the session just won't survive a refresh.
  }
}

/**
 * Store the access token a sign-in was granted, or clear it (`null`) on sign-out or when the API refuses
 * it. The token is also persisted on the web so a page refresh keeps the session (restoreLocalSession
 * reads it).
 */
export function setAccessToken(token: string | null): void {
  localToken = token;
  persistToken(token);
  emit();
}

/**
 * Restore a persisted dev-login token on the web (local provider) so a refresh keeps the presenter signed
 * in. Run once from the app root in a client effect (never at module load), so the read is client-only and
 * happens after the first render; the restore then re-renders readers through setAccessToken.
 */
export function restoreLocalSession(): void {
  if (localToken !== null) return;
  const token = readPersistedToken();
  if (token) setAccessToken(token);
}

/**
 * Whether a session is held, for a component that renders from it: the entry route sends a visitor to
 * sign-in or the workspace, and the navigation asks `/me` only with a session. A subscription, never a
 * read of the token during render: the React Compiler (app.json) keeps such a read at its first value for
 * the component's life, and nothing would render the component again when signing in or out changes it.
 *
 *   const hasSession = useIsSignedIn();
 *   const me = useMe({ enabled: hasSession });
 */
export function useIsSignedIn(): boolean {
  return useSyncExternalStore(subscribe, isSignedIn, isSignedIn);
}
