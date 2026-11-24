import { errors } from "@ampm/core";
import { z } from "zod";

import { addDays } from "./hotel-info-request-link.js";

/*
 * Extending a hotel information request's link (D-188 §3 and §4): a link lives `linkValidityDays` from
 * creation and may be extended up to `maxExtensionDays` past that first expiry, never further. Expiry is
 * worked out from `expires_at`, never a status, so an expired request is extended back to life within the
 * limit. Reissuing a link keeps its expiry.
 */

/** The `from` an `expiry_extended` event records: the expiry before that extension. */
const extendedFrom = z.object({ from: z.iso.datetime() });

/**
 * The first expiry: the `from` of the request's earliest extension, else its current expiry (it has not
 * been extended). A detail without a readable time is not trusted, so the current expiry stands.
 *
 * @example
 * firstExpiryOf(null, request.expiresAt); // request.expiresAt
 */
export function firstExpiryOf(earliestExtension: unknown, current: Date): Date {
  const parsed = extendedFrom.safeParse(earliestExtension);
  return parsed.success ? new Date(parsed.data.from) : current;
}

/**
 * The latest expiry an extension may set.
 *
 * @example
 * extensionLimit(firstExpiry, policy.maxExtensionDays);
 */
export function extensionLimit(firstExpiry: Date, maxExtensionDays: number): Date {
  return addDays(firstExpiry, maxExtensionDays);
}

/** What an update asks of the expiry. */
export interface ExpiryChange {
  readonly extendDays?: number | undefined;
  readonly expiresAt?: string | undefined;
}

/** The request's current expiry, the latest an extension may set, and now. */
export interface ExpiryWindow {
  readonly current: Date;
  readonly limit: Date;
  readonly now: Date;
}

/**
 * The expiry an update sets, or null when it extends nothing. Days are added to the later of now and the
 * current expiry, so extending an expired link reopens it for that many days; a new expiry must be later
 * than both. Past the limit, or not later, is a 400 naming the field.
 *
 * @example
 * nextExpiry({ extendDays: 14 }, { current, limit, now }); // current + 14 days
 */
export function nextExpiry(change: ExpiryChange, window: ExpiryWindow): Date | null {
  const { current, limit, now } = window;
  let next: Date;
  let path: "extendDays" | "expiresAt";
  if (change.extendDays !== undefined) {
    next = addDays(current > now ? current : now, change.extendDays);
    path = "extendDays";
  } else if (change.expiresAt !== undefined) {
    next = new Date(change.expiresAt);
    path = "expiresAt";
  } else {
    return null;
  }
  if (next <= current || next <= now) {
    const message = "The new expiry must be later than the current one, and in the future";
    throw errors.validation([{ path, message }], message);
  }
  if (next > limit) {
    const message = `This link can be extended to ${limit.toISOString()} at the latest`;
    throw errors.validation([{ path, message }], message);
  }
  return next;
}
