import type { ReactNode } from "react";

import { isAppError, type ErrorCode } from "@ampm/core";

import { uiCopy } from "../../copy";
import { EmptyState } from "../empty-state";
import { ErrorState } from "../error-state";
import type { IconName } from "../icon";
import { OfflineState } from "../offline-state";
import type { StateViewProps } from "../state-view";

/** What a 404 or a 403 means on one screen: its words, and an icon where the default does not fit. */
export interface QueryErrorMeaning {
  readonly title: string;
  readonly description?: string | undefined;
  readonly icon?: IconName | undefined;
}

/** The sign-in state's words; each falls back to `uiCopy.queryError.signIn`. */
export interface QueryErrorSignIn {
  readonly title?: string | undefined;
  readonly description?: string | undefined;
  readonly actionLabel?: string | undefined;
}

/** What reaches whichever state is drawn: `className`, `testID`, `blur` and the other view props. */
type StateBaseProps = Omit<
  StateViewProps,
  "icon" | "iconTone" | "title" | "description" | "action" | "announce"
>;

export interface QueryErrorStateProps extends StateBaseProps {
  /** The failed query's error: an `AppError` from the API client, or anything else. */
  readonly error: unknown;
  /** Runs the query again, from the offline state and the generic error. */
  readonly onRetry?: (() => void) | undefined;
  /**
   * Takes the person to sign in: the sign-in state's gold action. The app navigates (this library
   * never does). Without it a 401 is the generic error.
   */
  readonly onSignIn?: (() => void) | undefined;
  readonly signIn?: QueryErrorSignIn | undefined;
  /** What a 404 means on this screen; without it a 404 is the generic error. */
  readonly notFound?: QueryErrorMeaning | undefined;
  /** What a 403 means on this screen (a role without the grant); without it, the generic error. */
  readonly forbidden?: QueryErrorMeaning | undefined;
  /**
   * Under the generic error only: the way out a screen keeps in reach while it cannot load, such as
   * sign-out when the account itself cannot be read.
   */
  readonly errorFooter?: ReactNode;
}

interface SignInStateProps extends StateBaseProps {
  readonly onSignIn: () => void;
  readonly copy: QueryErrorSignIn | undefined;
}

/** A session that has ended: a lock, the screen's words and the gold way back to sign-in. */
function SignInState({ onSignIn, copy, ...rest }: SignInStateProps) {
  return (
    <EmptyState
      icon="lock"
      title={copy?.title ?? uiCopy.queryError.signIn.title}
      description={copy?.description}
      action={{
        label: copy?.actionLabel ?? uiCopy.queryError.signIn.action,
        variant: "primary",
        onPress: onSignIn,
      }}
      {...rest}
    />
  );
}

/** The screen's meaning for a 404 or a 403, with the icon each one defaults to; none otherwise. */
function meaningOf(
  code: ErrorCode | null,
  { notFound, forbidden }: Pick<QueryErrorStateProps, "notFound" | "forbidden">,
): (QueryErrorMeaning & { readonly icon: IconName }) | undefined {
  if (code === "not_found" && notFound) return { ...notFound, icon: notFound.icon ?? "inbox" };
  if (code === "forbidden" && forbidden) return { ...forbidden, icon: forbidden.icon ?? "lock" };
  return undefined;
}

/**
 * A failed query in the shared states (code.md: every screen handles error and offline): offline
 * with a retry; signed out, with the gold way back to sign-in, where the screen gives one; what a 404
 * or a 403 means, where the screen says; otherwise the generic error with a retry, which never shows
 * the raw message. The strings default from `uiCopy`; screens pass their own.
 *
 *   <QueryErrorState
 *     error={lead.error}
 *     onRetry={() => void lead.refetch()}
 *     onSignIn={goToSignIn}
 *     signIn={{ title: "Sign in to view this lead" }}
 *     notFound={{ title: "Lead not found", description: "It may have been removed." }}
 *   />
 */
export function QueryErrorState({
  error,
  onRetry,
  onSignIn,
  signIn,
  notFound,
  forbidden,
  errorFooter,
  ...rest
}: QueryErrorStateProps) {
  const code = isAppError(error) ? error.code : null;
  if (code === "network_error") return <OfflineState onRetry={onRetry} {...rest} />;
  if (code === "unauthenticated" && onSignIn) {
    return <SignInState onSignIn={onSignIn} copy={signIn} {...rest} />;
  }
  const meaning = meaningOf(code, { notFound, forbidden });
  if (meaning) {
    const { icon, title, description } = meaning;
    return <EmptyState icon={icon} title={title} description={description} {...rest} />;
  }
  return (
    <>
      <ErrorState onRetry={onRetry} {...rest} />
      {errorFooter}
    </>
  );
}
