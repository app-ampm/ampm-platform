import { useEffect } from "react";

import { ButtonLink } from "@/components/site/button-link";

import { logPageError, type PageErrorScope } from "./error-log";
import { ERROR_CONTENT as COPY } from "./errors-content";
import { RetryButton } from "./retry-button";
import { StatusPage } from "./status-page";

export interface ErrorPageProps {
  /** What the page threw: an Error from a Server Component, or any value from a Client Component. */
  readonly error: unknown;
  /** Next's `retry`: fetch the failed page again and draw it. */
  readonly retry: () => void;
  readonly scope: PageErrorScope;
}

/**
 * What a page that throws shows instead of Next's bare error screen (app/error.tsx inside the site's
 * frame; app/global-error.tsx when the frame itself failed): what happened, never the raw error, with
 * "Try again" as the gold action and the home page as the way out. The error is logged once. Client
 * code: only the client error boundaries render it, and its `<title>` stands in for metadata, which
 * client boundaries cannot export.
 *
 *   <ErrorPage error={error} retry={retry} scope="page" />
 */
export function ErrorPage({ error, retry, scope }: ErrorPageProps) {
  useEffect(() => logPageError(scope, error), [scope, error]);
  return (
    <>
      <title>{COPY.metaTitle}</title>
      <StatusPage
        eyebrow={COPY.eyebrow}
        title={COPY.title}
        emphasis={COPY.emphasis}
        body={COPY.body}
        actions={
          <>
            <RetryButton onRetry={retry}>{COPY.retry}</RetryButton>
            <ButtonLink href="/" variant="secondary" size="lg">
              {COPY.home}
            </ButtonLink>
          </>
        }
      />
    </>
  );
}
