import { SetMetadata } from "@nestjs/common";

export const RATE_LIMIT = "ampm:rate_limit";
export const RATE_LIMIT_EXEMPT = "ampm:rate_limit_exempt";

export interface RateLimitOptions {
  /** A name for the bucket (e.g. "auth.activate") so routes do not share each other's counters. */
  readonly name: string;
  /** The most requests one caller (the signed-in principal, else the client network) may make per window. */
  readonly limit: number;
  /** The window length, in milliseconds. */
  readonly windowMs: number;
  /**
   * For a signed-in caller, the most requests their client network (an IPv4 address or an IPv6 /64) may
   * make per window, whichever accounts they come from, so one network cannot spread a burst over
   * several. Not needed on a public route: an anonymous caller is already counted by network, under
   * `limit`.
   */
  readonly perIpLimit?: number;
  /**
   * What the route does when the limiter's store cannot count: `true` refuses with 503, for sign-in and
   * the routes that spend money or storage, which must never run uncounted; `false` lets the request
   * through, so a broken limiter never locks anyone out of reading (D-046, D-149).
   */
  readonly failClosed: boolean;
}

/**
 * Caps how often one caller — the authenticated principal, or the client IP before they authenticate —
 * may hit a route, to blunt brute force and abuse (security.md); `perIpLimit` adds a cap per client
 * network for signed-in callers. `RateLimitGuard` enforces it; over the limit is a 429 `rate_limited`
 * with a `Retry-After` header. On a controller it covers every route there that has none of its own.
 * Every route a non-staff caller can reach carries one, or a reasoned @RateLimitExempt
 * (rate-limit-coverage.spec.ts).
 *
 * @example
 * \@RateLimit({ name: "auth.activate", limit: 10, windowMs: 60_000, failClosed: true })
 * \@RateLimit({ name: "crm.portal.subscribe", limit: 10, perIpLimit: 30, windowMs: HOUR, failClosed: true })
 * \@RateLimit(CLIENT_READS) // a shared limit from route-limits.ts, here on a whole controller
 */
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT, options);

/**
 * Marks a route a non-staff caller can reach that deliberately carries no rate limit, with the reason —
 * the health check, which the deploy gate and monitoring poll and which does no work worth limiting.
 * The reason keeps the exemption a reviewed choice, as @AuditExempt does for audits.
 */
export const RateLimitExempt = (reason: string) => SetMetadata(RATE_LIMIT_EXEMPT, reason);
