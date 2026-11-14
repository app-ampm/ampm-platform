import { Button } from "@ampm/ui";

import { useSignOut } from "./sign-out";
import { useWindowClass } from "./use-window-class";

export interface SignOutButtonProps {
  /** Placement on wider windows, where the button keeps its own width (`md:self-center` under an error). */
  readonly className?: string | undefined;
}

/**
 * The secondary "Sign out" (`useSignOut`): the account (More) screen's own, and the way out that the
 * account and portal screens keep under their error state when `/me` cannot be read, since the
 * navigation then has no person to show. Full width on a phone (P10); from 768 it keeps its own width
 * rather than stretching across the page.
 *
 *   <QueryErrorState error={me.error} onRetry={retry} errorFooter={<SignOutButton className="md:self-center" />} />
 */
export function SignOutButton({ className }: SignOutButtonProps) {
  const signOut = useSignOut();
  const { isWide } = useWindowClass();
  return (
    <Button
      variant="secondary"
      icon="log-out"
      fullWidth={!isWide}
      onPress={signOut}
      className={className}
    >
      Sign out
    </Button>
  );
}
