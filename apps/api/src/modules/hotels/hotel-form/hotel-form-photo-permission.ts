import type { HotelFormPhotoPermission } from "@ampm/core";

/*
 * A signed-in person's own answer to 7.5 (D-190 §3), which `me` and the verify answer carry so HF-07
 * offers withdrawing a permission only when one was given. Consents are append-only (a resubmit records
 * a new 7.5 against its revision's hash, a withdrawal stamps `withdrawnAt`), so the answer is the newest
 * display consent still on record: yes or no as it says, none when there is none (never submitted, or
 * withdrawn). Deleted consents are not read at all (hotel-form-people.repository.ts).
 */

/** A display consent as the answer reads it. */
export interface DisplayConsentRow {
  readonly id: string;
  readonly granted: boolean;
  readonly recordedAt: Date;
  readonly withdrawnAt: Date | null;
}

/** Newest first: by when it was recorded, then by id (ids are time-ordered UUIDv7s). */
function isNewer(a: DisplayConsentRow, b: DisplayConsentRow): boolean {
  const byTime = a.recordedAt.getTime() - b.recordedAt.getTime();
  return byTime === 0 ? a.id > b.id : byTime > 0;
}

/**
 * The person's own answer to 7.5 from their display consents not deleted, in any order.
 *
 * @example
 * photoPermissionOf([{ id, granted: true, recordedAt, withdrawnAt: now }]); // "none"
 */
export function photoPermissionOf(
  consents: readonly DisplayConsentRow[],
): HotelFormPhotoPermission {
  let newest: DisplayConsentRow | null = null;
  for (const consent of consents) {
    if (consent.withdrawnAt !== null) continue;
    if (newest === null || isNewer(consent, newest)) newest = consent;
  }
  if (newest === null) return "none";
  return newest.granted ? "yes" : "no";
}
