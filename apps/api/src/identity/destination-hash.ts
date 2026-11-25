import { createHmac } from "node:crypto";

/** A plus, then 8 to 15 digits, the first not a zero: what E.164 allows. */
const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * A mobile's at-rest key for the hotel form (D-189 §1): `hotel_info_request_challenges.destination_hash`,
 * the HMAC-SHA256 of the E.164 number under the address key (`SignInKeys.hotelFormAddress`), as 64 hex
 * characters. The per-mobile limits and the lockout key on it, so neither stores nor keys on the number.
 * The number must already be E.164 (one spelling per mobile, or one mobile would count as two); anything
 * else is a programming error and throws.
 *
 * @example
 * hashDestination("+919000000001", keys.hotelFormAddress); // "5f0c…" (64 hex characters)
 */
export function hashDestination(e164: string, key: Buffer): string {
  if (!E164.test(e164)) throw new Error("hashDestination needs an E.164 number, normalised first");
  return createHmac("sha256", key).update(e164).digest("hex");
}
