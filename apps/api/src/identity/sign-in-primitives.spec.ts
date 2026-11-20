import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { hashPassword, verifyAgainstDummy, verifyPassword } from "./password-hasher.js";
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  normaliseRecoveryCode,
} from "./recovery-codes.js";
import { deriveKey, SecretBox } from "./secret-box.js";
import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  matchTotp,
  stepAt,
  totpAt,
  totpUri,
} from "./totp.js";

describe("TOTP (RFC 6238)", () => {
  // Appendix B of RFC 6238: the SHA-1 seed "12345678901234567890" and its 8-digit codes.
  const seed = base32Encode(Buffer.from("12345678901234567890", "ascii"));
  const vectors: ReadonlyArray<[number, string]> = [
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ];

  it.each(vectors)("matches the RFC vector at T=%i", (seconds, expected) => {
    expect(totpAt(seed, Math.floor(seconds / 30), 8)).toBe(expected);
    // Six digits are the last six of the eight (both are the binary value modulo a power of ten).
    expect(totpAt(seed, Math.floor(seconds / 30))).toBe(expected.slice(2));
  });

  it("round-trips base32 and makes a 160-bit secret", () => {
    const bytes = randomBytes(20);
    expect(base32Decode(base32Encode(bytes)).equals(bytes)).toBe(true);
    expect(base32Decode(generateTotpSecret())).toHaveLength(20);
  });

  it("accepts one step of drift either way and nothing further", () => {
    const secret = generateTotpSecret();
    const now = new Date("2026-11-20T10:00:00Z");
    const step = stepAt(now);
    expect(matchTotp(secret, totpAt(secret, step - 1), now, null)).toBe(step - 1);
    expect(matchTotp(secret, totpAt(secret, step + 1), now, null)).toBe(step + 1);
    expect(matchTotp(secret, totpAt(secret, step - 2), now, null)).toBeNull();
  });

  it("never accepts the same step twice, or an older one", () => {
    const secret = generateTotpSecret();
    const now = new Date("2026-11-20T10:00:00Z");
    const step = stepAt(now);
    expect(matchTotp(secret, totpAt(secret, step), now, step)).toBeNull();
    expect(matchTotp(secret, totpAt(secret, step - 1), now, step - 1)).toBeNull();
  });

  it("labels the otpauth URI for the app", () => {
    expect(totpUri("asha@ampmverse.com", "JBSWY3DPEHPK3PXP")).toBe(
      "otpauth://totp/AMPM%3Aasha%40ampmverse.com?secret=JBSWY3DPEHPK3PXP&issuer=AMPM&algorithm=SHA1&digits=6&period=30",
    );
  });
});

describe("password hashing (Argon2id)", () => {
  it("verifies the right password and refuses a wrong one", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(stored).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(await verifyPassword("correct horse battery staple", stored)).toBe(true);
    expect(await verifyPassword("correct horse battery stapl", stored)).toBe(false);
  });

  it("salts every hash and never matches a malformed one", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
    expect(await verifyAgainstDummy("anything")).toBe(false);
  });
});

describe("SecretBox (AES-256-GCM)", () => {
  const box = new SecretBox(deriveKey("a test secret that is long enough", "totp"));

  it("opens what it sealed, with a fresh IV each time", () => {
    const sealed = box.seal("JBSWY3DPEHPK3PXP");
    expect(sealed).toMatch(/^v1\./);
    expect(box.open(sealed)).toBe("JBSWY3DPEHPK3PXP");
    expect(box.seal("JBSWY3DPEHPK3PXP")).not.toBe(sealed);
  });

  it("refuses a tampered value and a different key", () => {
    const sealed = box.seal("JBSWY3DPEHPK3PXP");
    // Change the second-to-last character (all ciphertext bits, unlike the last), and never to itself:
    // choosing the new letter from a different position left the value intact one run in 64.
    const at = sealed.length - 2;
    const tampered = `${sealed.slice(0, at)}${sealed[at] === "A" ? "B" : "A"}${sealed.slice(at + 1)}`;
    expect(() => box.open(tampered)).toThrow();
    const other = new SecretBox(deriveKey("a different secret, also long enough", "totp"));
    expect(() => other.open(sealed)).toThrow();
  });
});

describe("recovery codes", () => {
  it("issues ten distinct XXXXX-XXXXX codes", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) expect(code).toMatch(/^[A-Z2-7]{5}-[A-Z2-7]{5}$/);
  });

  it("treats case, the dash and spaces as the same code", () => {
    const key = deriveKey("a test secret that is long enough", "recovery");
    expect(normaliseRecoveryCode(" abcde-23456 ")).toBe("ABCDE23456");
    expect(hashRecoveryCode("abcde23456", key)).toBe(hashRecoveryCode("ABCDE-23456", key));
    expect(hashRecoveryCode("ABCDE-23457", key)).not.toBe(hashRecoveryCode("ABCDE-23456", key));
  });

  it("keys the stored hash, so a leaked table cannot be searched without the server key", () => {
    const one = deriveKey("a test secret that is long enough", "recovery");
    const other = deriveKey("a different secret, also long enough", "recovery");
    expect(hashRecoveryCode("ABCDE-23456", one)).not.toBe(hashRecoveryCode("ABCDE-23456", other));
  });
});
