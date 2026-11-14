import { useSyncExternalStore } from "react";

import { getCognitoAccessToken, isCognitoSignedIn, onCognitoAuthEvent } from "./cognito-auth";
import { env } from "./env";

/** Whether the app signs in through Amazon Cognito (vs the local dev-login), fixed at build time. */
const isCognito = env.EXPO_PUBLIC_IDENTITY_PROVIDER === "cognito";

/**
 * The access token sent as the Bearer on every API request, and the signed-in flag the entry gate and
 * navigation read — one surface over two providers:
 *
 * - `cognito`: the token comes from Amplify (`getCognitoAccessToken`, silently refreshed); the signed-in
 *   flag is seeded and kept current from Amplify's auth events by `initAuthSession`, and nudged by the
 *   sign-in screen and sign-out through `setCognitoSignedIn`.
 * - `local` (dev-login): an in-memory token the dev sign-in screen sets. A development build seeds it from
 *   the env token; production never carries one (`__DEV__` is false, so the minifier drops the read, and
 *   the API refuses local tokens anyway — security.md).
 */
let localToken: string | null =
  !isCognito && __DEV__ ? (env.EXPO_PUBLIC_DEV_ACCESS_TOKEN ?? null) : null;

let cognitoSignedIn = false;

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
  return isCognito ? cognitoSignedIn : localToken !== null;
}

/** The token the typed client attaches to each request (via `getAccessToken` on the ApiProvider). */
export function getAccessToken(): string | null | Promise<string | null> {
  return isCognito ? getCognitoAccessToken() : localToken;
}

/** Where the dev-login token is persisted on the web so a refresh keeps the session (local provider only). */
const DEV_TOKEN_KEY = "ampm.devToken";

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
 * Store the local dev-login token, or clear it (`null`) on sign-out or when the API refuses it. Only the
 * `local` provider keeps a token here; under `cognito` the session is Amplify's, so this is a no-op. The
 * token is also persisted on the web so a page refresh keeps the session (restoreLocalSession reads it).
 */
export function setAccessToken(token: string | null): void {
  if (isCognito) return;
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
  if (isCognito || localToken !== null) return;
  const token = readPersistedToken();
  if (token) setAccessToken(token);
}

/** Mark the Cognito session signed in or out (from the sign-in screen and sign-out), re-rendering readers. */
export function setCognitoSignedIn(signedIn: boolean): void {
  if (!isCognito) return;
  cognitoSignedIn = signedIn;
  emit();
}

/** At the app root (cognito only): seed the signed-in flag from the current session and track Amplify's events. */
export function initAuthSession(): void {
  if (!isCognito) return;
  const refresh = (): void => {
    void isCognitoSignedIn().then((signedIn) => {
      cognitoSignedIn = signedIn;
      emit();
    });
  };
  refresh();
  onCognitoAuthEvent(refresh);
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
