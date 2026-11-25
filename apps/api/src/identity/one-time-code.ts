import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

/*
 * One-time codes: six digits from the CSPRNG, kept at rest only as an HMAC-SHA256 under a server key and
 * bound to what they are for: a client's account (D-147, `SignInKeys.otpKey`) or a hotel-form code
 * challenge (D-189 §2, `SignInKeys.hotelFormCode`). Six digits are a million guesses, so a plain hash of a
 * leaked row could be reversed in a moment; the keyed HMAC cannot be without the key, and a code never
 * matches another account's or another challenge's, nor under another purpose's key.
 */

/** How long a code stays valid. */
export const ONE_TIME_CODE_TTL_MS = 5 * 60 * 1000;

/** A fresh six-digit code, leading zeros kept. */
export function generateOneTimeCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * The code's at-rest form, bound to the id it was issued for (an account's or a challenge's).
 *
 * @example
 * hashOneTimeCode(challenge.id, code, keys.hotelFormCode); // 64 hex characters
 */
export function hashOneTimeCode(boundId: string, code: string, key: Buffer): string {
  return createHmac("sha256", key).update(`${boundId}:${code}`).digest("hex");
}

/** Whether a typed code is the one stored for this id, compared in constant time. */
export function oneTimeCodeMatches(
  boundId: string,
  code: string,
  storedHash: string,
  key: Buffer,
): boolean {
  const expected = Buffer.from(hashOneTimeCode(boundId, code, key), "hex");
  const stored = Buffer.from(storedHash, "hex");
  return stored.length === expected.length && timingSafeEqual(stored, expected);
}
