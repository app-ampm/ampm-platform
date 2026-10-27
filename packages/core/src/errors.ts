/**
 * Typed errors and the one response envelope (api.md). The API maps every failure to
 * `{ error: { code, message, details? } }` with the status below; clients map the same codes back to
 * typed errors. Denial is silent about existence: a record the principal may not see is `not_found`.
 */
export const ERROR_CODES = {
  validation_failed: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  /** The request body is over the API's limit (the body parser refuses it before any handler). */
  payload_too_large: 413,
  /** The request body's media type or charset is not one the API reads. */
  unsupported_media_type: 415,
  rate_limited: 429,
  internal: 500,
  unavailable: 503,
  /** Client side only: the request never reached the API. */
  network_error: 0,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export interface ErrorDetail {
  /** Dotted path of the offending field, when there is one. */
  readonly path?: string | undefined;
  readonly message: string;
}

export interface ApiFailure {
  readonly error: {
    readonly code: ErrorCode;
    readonly message: string;
    readonly details?: readonly ErrorDetail[] | undefined;
  };
}

export interface ApiSuccess<T> {
  readonly data: T;
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export function isApiFailure(value: unknown): value is ApiFailure {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as ApiFailure).error === "object"
  );
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: readonly ErrorDetail[] | undefined;

  constructor(code: ErrorCode, message: string, details?: readonly ErrorDetail[], status?: number) {
    super(message);
    this.name = "AppError";
    this.code = code;
    // The code decides the status; a framework exception with another 4xx status may keep it.
    this.status = status ?? ERROR_CODES[code];
    this.details = details;
  }

  toEnvelope(): ApiFailure {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}

export const errors = {
  validation: (details: readonly ErrorDetail[], message = "Validation failed") =>
    new AppError("validation_failed", message, details),
  unauthenticated: (message = "Sign in to continue") => new AppError("unauthenticated", message),
  forbidden: (message = "You cannot do that") => new AppError("forbidden", message),
  /** The same answer for a missing record and a record the principal may not see. */
  notFound: (message = "Not found") => new AppError("not_found", message),
  conflict: (message: string) => new AppError("conflict", message),
  payloadTooLarge: (message = "Request body too large") =>
    new AppError("payload_too_large", message),
  unsupportedMediaType: (message = "Unsupported media type") =>
    new AppError("unsupported_media_type", message),
  rateLimited: (message = "Too many requests") => new AppError("rate_limited", message),
  internal: (message = "Something went wrong") => new AppError("internal", message),
  unavailable: (message = "Service unavailable") => new AppError("unavailable", message),
  network: (message = "Could not reach the server") => new AppError("network_error", message),
} as const;

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
