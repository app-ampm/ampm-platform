import { Button } from "@ampm/ui";

import { useSignOut } from "./sign-out";

/**
 * The full-width secondary "Sign out" (`useSignOut`): the account (More) screen's own, and the way out
 * that the account and portal screens keep under their error state when `/me` cannot be read, since
 * the navigation then has no person to show.
 *
 *   <ErrorState onRetry={retry} />
 *   <SignOutButton />
 */
export function SignOutButton() {
  const signOut = useSignOut();
  return (
    <Button variant="secondary" icon="log-out" fullWidth onPress={signOut}>
      Sign out
    </Button>
  );
}
