/**
 * @ampm/core: pure TypeScript shared by the apps and the API; no React, no I/O (code.md).
 */
export const CORE_VERSION = "0.2.0";

export { clientAmount, formatAmount, internalAmount } from "./money";
export type { ClientAmount, Currency, InternalAmount } from "./money";

export { AppError, ERROR_CODES, errors, isApiFailure, isAppError } from "./errors";
export type { ApiEnvelope, ApiFailure, ApiSuccess, ErrorCode, ErrorDetail } from "./errors";

export { consoleSink, createLogger, createMemoryLogger, redact } from "./logger";
export type { LogEntry, LogFields, LogLevel, LogSink, Logger, LoggerOptions } from "./logger";

export { parseEnv } from "./env";

export * from "./schemas";

export { createI18n, en } from "./i18n";
export type { Locale } from "./i18n";
