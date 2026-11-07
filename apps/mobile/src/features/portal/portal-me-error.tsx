import { useRouter } from "expo-router";

import { isAppError } from "@ampm/core";
import { EmptyState, ErrorState, OfflineState } from "@ampm/ui";

import { SignOutButton } from "@/navigation/sign-out-button";

export interface PortalMeErrorProps {
  readonly error: unknown;
  readonly onRetry: () => void;
}

/**
 * `/me` failed: offline, signed out (with the way back to sign-in), or any other failure with a retry
 * and sign-out, which stays in reach while the account cannot be read and the navigation has no
 * person to show.
 */
export function PortalMeError({ error, onRetry }: PortalMeErrorProps) {
  const router = useRouter();
  if (isAppError(error) && error.code === "network_error") {
    return <OfflineState onRetry={onRetry} />;
  }
  if (isAppError(error) && error.code === "unauthenticated") {
    return (
      <EmptyState
        icon="lock"
        title="Sign in to view your plan"
        action={{ label: "Sign in", variant: "primary", onPress: () => router.replace("/sign-in") }}
      />
    );
  }
  return (
    <>
      <ErrorState onRetry={onRetry} />
      <SignOutButton />
    </>
  );
}
