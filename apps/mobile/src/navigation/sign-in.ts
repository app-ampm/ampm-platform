import { useSignOut } from "./sign-out";

/**
 * The way back to sign-in from a screen whose session has ended (QueryErrorState's `onSignIn`, shown
 * when the API refuses the token with a 401). It signs out on the way, as `useSignOut` does: the
 * refused token is dropped and the cache cleared, since a token still held would ride on every later
 * request and keep the navigation asking `/me`, refused again on every window focus. It replaces the
 * screen: a signed-out screen has nothing to come back to.
 *
 *   const goToSignIn = useGoToSignIn();
 *   <QueryErrorState error={query.error} onRetry={retry} onSignIn={goToSignIn} />
 */
export function useGoToSignIn(): () => void {
  return useSignOut();
}
