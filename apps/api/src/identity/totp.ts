import { createHmac, randomBytes } from "node:crypto";

/**
 * Time-based one-time passwords (RFC 6238, D-142) for the staff authenticator: HMAC-SHA1, six digits,
 * 30-second steps, the defaults every authenticator app understands. Built on Node's own crypto; the
 * unit test checks the RFC's published vectors.
 *
 * @example
 * const secret = generateTotpSecret();
 * const step = matchTotp(secret, "123456", new Date(), user.totpLastStep); // the step, or null
 */
const STEP_SECONDS = 30;
const DIGITS = 6;
const ISSUER = "AMPM";
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** RFC 4648 base32 without padding, the alphabet authenticator apps read. */
export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of text.toUpperCase().replace(/=+$/, "")) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new Error("not base32");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** A new 160-bit secret (RFC 4226's recommended length), base32-encoded for the app. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** The code for a time step (the HOTP value of RFC 4226 at counter = step). */
export function totpAt(secret: string, step: number, digits: number = DIGITS): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = (mac[mac.length - 1] ?? 0) & 0x0f;
  const binary = mac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** digits).padStart(digits, "0");
}

/** The time step a moment falls in. */
export function stepAt(now: Date): number {
  return Math.floor(now.getTime() / 1000 / STEP_SECONDS);
}

/**
 * The step a code matches, allowing one step of clock drift either way, or null. A step at or before
 * `lastStep` never matches, so a code that was already used (or an older one) cannot be replayed.
 */
export function matchTotp(
  secret: string,
  code: string,
  now: Date,
  lastStep: number | null,
): number | null {
  const current = stepAt(now);
  for (const step of [current - 1, current, current + 1]) {
    if (lastStep !== null && step <= lastStep) continue;
    if (totpAt(secret, step) === code) return step;
  }
  return null;
}

/** The otpauth:// URI the enrolment QR code encodes, labelled "AMPM:<email>". */
export function totpUri(account: string, secret: string): string {
  const label = encodeURIComponent(`${ISSUER}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer: ISSUER,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
