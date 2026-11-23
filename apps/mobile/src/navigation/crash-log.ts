import { createLogger, type Logger } from "@ampm/core";

const crashLogger = createLogger({ app: "mobile" });

/** Where a boundary caught the crash: one screen (the navigation kept working) or the whole app. */
export type CrashScope = "screen" | "app";

/**
 * Logs a crash a boundary caught, through the core logger (code.md: never `console`): the error's
 * name and message only, never the component tree or its props, which can carry a person's data.
 *
 *   useEffect(() => logCrash("screen", error), [error]);
 */
export function logCrash(scope: CrashScope, error: Error, logger: Logger = crashLogger): void {
  logger.error("ui.crash", { scope, name: error.name, message: error.message });
}
