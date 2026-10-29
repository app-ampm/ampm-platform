import { SetMetadata } from "@nestjs/common";

export const RATE_LIMIT = "ampm:rate_limit";

export interface RateLimitOptions {
  /** A name for the bucket (e.g. "auth.activate") so routes do not share each other's counters. */
  readonly name: string;
  /** The most requests one caller may make per window. */
  readonly limit: number;
  /** The window length, in milliseconds. */
  readonly windowMs: number;
}

/**
 * Caps how often one caller — the authenticated principal, or the client IP before they authenticate —
 * may hit a route, to blunt brute force and abuse (security.md). `RateLimitGuard` enforces it; over the
 * limit is a 429 `rate_limited` with a `Retry-After` header. Undecorated routes are not limited.
 *
 * @example
 * \@RateLimit({ name: "auth.activate", limit: 10, windowMs: 60_000 })
 */
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT, options);
