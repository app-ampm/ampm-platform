import { useRouter } from "expo-router";

import { isAppError } from "@ampm/core";
import { EmptyState, ErrorState, OfflineState, type IconName } from "@ampm/ui";

/** What a 404 means on a screen: its words, and an icon other than the empty inbox if it needs one. */
export interface NotFoundMeaning {
  readonly title: string;
  readonly description: string;
  readonly icon?: IconName | undefined;
}

export interface HotelsQueryErrorProps {
  readonly error: Error;
  readonly onRetry: () => void;
  /** The sign-in prompt when the session has gone: "Sign in to browse hotels". */
  readonly signInTitle: string;
  /** What a 404 means on this screen; without it a 404 is the plain retryable error. */
  readonly notFound?: NotFoundMeaning | undefined;
}

/**
 * The failed states the hotels screens share (code.md: every screen handles them with the shared
 * components): offline, signed out (with the way back to sign-in), not found where the screen has a
 * meaning for it, and otherwise the retryable error, which never shows the raw message.
 */
export function HotelsQueryError({ error, onRetry, signInTitle, notFound }: HotelsQueryErrorProps) {
  const router = useRouter();
  const code = isAppError(error) ? error.code : null;
  if (code === "network_error") return <OfflineState onRetry={onRetry} />;
  if (code === "unauthenticated")
    return (
      <EmptyState
        icon="lock"
        title={signInTitle}
        action={{ label: "Sign in", variant: "primary", onPress: () => router.replace("/sign-in") }}
      />
    );
  if (code === "not_found" && notFound)
    return (
      <EmptyState
        icon={notFound.icon ?? "inbox"}
        title={notFound.title}
        description={notFound.description}
      />
    );
  return <ErrorState onRetry={onRetry} />;
}
