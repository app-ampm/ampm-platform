import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

/*
 * The clients' one-time sign-in codes (D-147): six digits from the CSPRNG, kept at rest only as an
 * HMAC-SHA256 under a server key and bound to the account. Six digits are a million guesses, so a plain
 * hash of a leaked row could be reversed in a moment; the keyed HMAC cannot be without the key, and a
 * code never matches another account's.
 */

/** How long a code stays valid. */
export const ONE_TIME_CODE_TTL_MS = 5 * 60 * 1000;

/** A fresh six-digit code, leading zeros kept. */
export function generateOneTimeCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** The code's at-rest form for this account. */
export function hashOneTimeCode(userId: string, code: string, key: Buffer): string {
  return createHmac("sha256", key).update(`${userId}:${code}`).digest("hex");
}

/** Whether a typed code is the one stored for this account, compared in constant time. */
export function oneTimeCodeMatches(
  userId: string,
  code: string,
  storedHash: string,
  key: Buffer,
): boolean {
  const expected = Buffer.from(hashOneTimeCode(userId, code, key), "hex");
  const stored = Buffer.from(storedHash, "hex");
  return stored.length === expected.length && timingSafeEqual(stored, expected);
}
