import { createLogger, type Logger } from "@ampm/core";

const errorLogger = createLogger({ app: "web" });

/** Which boundary caught it: one page under the site's frame, or the root layout itself. */
export type PageErrorScope = "page" | "root";

/** Next's digest on a Server Component's error: the key to the server's own log line. */
function digestOf(error: Error): string | undefined {
  return "digest" in error && typeof error.digest === "string" ? error.digest : undefined;
}

/**
 * Logs an error a boundary caught, through the core logger (code.md: never `console`): its name, its
 * message and Next's digest. A value thrown that is not an Error is logged by its type only. In
 * production a Server Component's message is already generic, so nothing private reaches the browser.
 *
 *   useEffect(() => logPageError("page", error), [error]);
 */
export function logPageError(
  scope: PageErrorScope,
  error: unknown,
  logger: Logger = errorLogger,
): void {
  const fields =
    error instanceof Error
      ? { name: error.name, message: error.message, digest: digestOf(error) }
      : { name: typeof error };
  logger.error("site.page_error", { scope, ...fields });
}
