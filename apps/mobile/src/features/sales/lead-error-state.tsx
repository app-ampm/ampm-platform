import { useRouter } from "expo-router";

import { isAppError } from "@ampm/core";
import { EmptyState, ErrorState, OfflineState } from "@ampm/ui";

export interface LeadErrorStateProps {
  readonly error: unknown;
  readonly onRetry: () => void;
  /** What an ended session says: "Sign in to view leads". */
  readonly signInTitle: string;
  readonly signInDescription?: string | undefined;
  /** The detail's 404 (a lead that is gone or out of reach); the list has none. */
  readonly notFound?: { readonly title: string; readonly description: string } | undefined;
}

/**
 * A failed lead query through the shared states: offline with a retry, a sign-in prompt once the
 * session has ended, the not-found state where the screen gives one, and the generic error otherwise.
 *
 *   <LeadErrorState error={lead.error} onRetry={retry} signInTitle="Sign in to view this lead" />
 */
export function LeadErrorState({
  error,
  onRetry,
  signInTitle,
  signInDescription,
  notFound,
}: LeadErrorStateProps) {
  const router = useRouter();
  const code = isAppError(error) ? error.code : null;
  if (code === "network_error") return <OfflineState onRetry={onRetry} />;
  if (code === "unauthenticated") {
    return (
      <EmptyState
        icon="lock"
        title={signInTitle}
        description={signInDescription}
        action={{ label: "Sign in", variant: "primary", onPress: () => router.replace("/sign-in") }}
      />
    );
  }
  if (code === "not_found" && notFound) {
    return <EmptyState icon="inbox" title={notFound.title} description={notFound.description} />;
  }
  return <ErrorState onRetry={onRetry} />;
}
