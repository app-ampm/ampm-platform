/*
 * The lock after burned codes (D-189 §2), pure. A challenge is burned when its 5 tries are spent without
 * the right code (it is retired at once, so `retired_at` is its burn time). After 3 burned challenges for
 * one mobile and request within an hour, that mobile is locked on that request for an hour from the third
 * burn. No code is issued while a lock holds, so no burn happens then: the three most recent burns decide.
 */

const HOUR_MS = 60 * 60 * 1000;

/** How many burns within {@link BURN_WINDOW_MS} lock the mobile, and for how long. */
export const BURNS_TO_LOCK = 3;
export const BURN_WINDOW_MS = HOUR_MS;
export const LOCK_MS = HOUR_MS;
/**
 * How far back the repository reads burns: the three that started a lock still holding may be up to an
 * hour older than the lock's hour.
 */
export const BURN_LOOKBACK_MS = BURN_WINDOW_MS + LOCK_MS;

/** A burned challenge as the repository reads it. */
export interface BurnedChallenge {
  readonly createdAt: Date;
  /** When its tries ran out and it was retired; null if the retirement has not landed yet. */
  readonly retiredAt: Date | null;
}

const burnTime = (burn: BurnedChallenge): number => (burn.retiredAt ?? burn.createdAt).getTime();

/**
 * When the lock on this mobile and request ends, or null when there is none at `now`.
 *
 * @example
 * const until = lockedUntil(await challenges.recentBurns(requestId, hash, since), now);
 * if (until) throw errors.rateLimited(HOTEL_FORM_ERRORS.mobileLocked, secondsUntil(until));
 */
export function lockedUntil(burns: readonly BurnedChallenge[], now: Date): Date | null {
  const times = burns.map(burnTime).sort((a, b) => b - a);
  const latest = times[0];
  const third = times[BURNS_TO_LOCK - 1];
  if (latest === undefined || third === undefined) return null;
  if (latest - third > BURN_WINDOW_MS) return null;
  const until = latest + LOCK_MS;
  return until > now.getTime() ? new Date(until) : null;
}
