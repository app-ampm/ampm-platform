import { env } from "./env";

/**
 * The access token sent as the Bearer on every API request. A development build is seeded from the
 * local env token (if set) for convenience; the dev sign-in screen sets it at runtime via a local
 * `/auth/dev-login`. Production builds never carry a local token — `__DEV__` is false there, so the
 * minifier drops the env read, and the API refuses local tokens anyway (security.md). The token is
 * held in memory only (not persisted), so a reload resets it to this seeded default.
 */
let currentToken: string | null = __DEV__ ? (env.EXPO_PUBLIC_DEV_ACCESS_TOKEN ?? null) : null;

/** The token the typed client attaches to each request (via `getAccessToken` on the ApiProvider). */
export function getAccessToken(): string | null {
  return currentToken;
}

/** Store the token after a dev sign-in, or clear it (pass `null`) on sign-out. */
export function setAccessToken(token: string | null): void {
  currentToken = token;
}

/** Whether a token is held — the entry route sends a visitor to sign-in or the workspace. */
export function isSignedIn(): boolean {
  return currentToken !== null;
}
