import { describe, expect, it } from "vitest";

import { deriveKey } from "./secret-box.js";
import { signInKeysFor, type SignInKeys } from "./sign-in-keys.js";

/*
 * The keys AMPM's sign-in derives (D-142, D-147) and the hotel form's two (D-189 §2): each one 32 bytes
 * from HKDF under its own label, in both identity branches, so a code or a mobile HMAC'd for one purpose
 * never matches under another. Built at run time, so no secret-looking literal sits in the repository.
 */

const ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
const OTHER_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
const LOCAL_SECRET = "l".repeat(40);

function ampm(encryptionKey = ENCRYPTION_KEY): SignInKeys {
  return signInKeysFor({
    IDENTITY_PROVIDER: "ampm",
    AUTH_TOKEN_SECRET: "t".repeat(40),
    AUTH_ENCRYPTION_KEY: encryptionKey,
  });
}

function local(secret = LOCAL_SECRET): SignInKeys {
  return signInKeysFor({ IDENTITY_PROVIDER: "local", IDENTITY_LOCAL_SECRET: secret });
}

/** Every HMAC key the keys hold, by name. */
function hmacKeys(keys: SignInKeys): Record<string, Buffer> {
  return {
    recoveryKey: keys.recoveryKey,
    otpKey: keys.otpKey,
    hotelFormCode: keys.hotelFormCode,
    hotelFormAddress: keys.hotelFormAddress,
  };
}

describe("signInKeysFor: the hotel form's keys (D-189 §2)", () => {
  it("derives the code and address keys from the encryption key under their own labels (ampm)", () => {
    const keys = ampm();
    expect(keys.hotelFormCode.equals(deriveKey(ENCRYPTION_KEY, "ampm/hotel-form-code"))).toBe(true);
    expect(keys.hotelFormAddress.equals(deriveKey(ENCRYPTION_KEY, "ampm/hotel-form-address"))).toBe(
      true,
    );
  });

  it("derives them from the local secret under the same labels (local)", () => {
    const keys = local();
    expect(keys.hotelFormCode.equals(deriveKey(LOCAL_SECRET, "ampm/hotel-form-code"))).toBe(true);
    expect(keys.hotelFormAddress.equals(deriveKey(LOCAL_SECRET, "ampm/hotel-form-address"))).toBe(
      true,
    );
  });

  it.each([
    ["ampm", ampm],
    ["local", local],
  ] as const)(
    "keeps every HMAC key 32 bytes and distinct from the others (%s)",
    (_branch, keys) => {
      const all = Object.entries(hmacKeys(keys()));
      for (const [name, key] of all) expect(key, name).toHaveLength(32);
      const distinct = new Set(all.map(([, key]) => key.toString("hex")));
      expect(distinct.size).toBe(all.length);
    },
  );

  it("gives the same keys for the same secret and other keys for another, so a restart keeps codes", () => {
    expect(ampm().hotelFormCode.equals(ampm().hotelFormCode)).toBe(true);
    expect(ampm().hotelFormAddress.equals(ampm().hotelFormAddress)).toBe(true);
    expect(ampm().hotelFormCode.equals(ampm(OTHER_ENCRYPTION_KEY).hotelFormCode)).toBe(false);
    expect(local().hotelFormAddress.equals(local("m".repeat(40)).hotelFormAddress)).toBe(false);
  });
});
