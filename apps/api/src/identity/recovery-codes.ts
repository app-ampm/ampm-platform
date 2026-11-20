import { createHmac, randomBytes } from "node:crypto";

/**
 * Single-use recovery codes for a staff authenticator (D-142): ten codes of ten base32 characters
 * (50 random bits each), written XXXXX-XXXXX, shown once at enrolment. Only an HMAC-SHA256 of the
 * normalised code under a server key is stored: 50 bits is too few to survive an offline search of a
 * leaked database with a plain hash, but without the key the stored values cannot be searched at all.
 *
 * @example
 * const codes = generateRecoveryCodes(); // ["K7Q2M-ZP4XA", …]
 * hashRecoveryCode("k7q2mzp4xa", key) === hashRecoveryCode("K7Q2M-ZP4XA", key); // true
 */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const RECOVERY_CODE_COUNT = 10;

function code(): string {
  // 32 divides 256, so masking a random byte keeps every character equally likely.
  const chars = [...randomBytes(10)].map((byte) => ALPHABET[byte & 31]).join("");
  return `${chars.slice(0, 5)}-${chars.slice(5)}`;
}

export function generateRecoveryCodes(count: number = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, code);
}

/** Upper case without the dash or spaces, so "abcde-23456" and "ABCDE23456" are the same code. */
export function normaliseRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z2-7]/g, "");
}

export function hashRecoveryCode(input: string, key: Buffer): string {
  return createHmac("sha256", key).update(normaliseRecoveryCode(input)).digest("hex");
}
