import { describe, expect, it } from "vitest";

import { hashDestination } from "./destination-hash.js";
import { signInKeysFor } from "./sign-in-keys.js";

/*
 * A hotel-form mobile's at-rest key (D-189 §1): `destination_hash`, the HMAC of the E.164 number under
 * the address key. The per-mobile limits and the lookups key on it, so they never store or key on the
 * number itself. Reserved fictitious numbers only.
 */

const keys = signInKeysFor({ IDENTITY_PROVIDER: "local", IDENTITY_LOCAL_SECRET: "l".repeat(40) });
const MOBILE = "+919000000001";

describe("hashDestination", () => {
  it("is a 64-character hex HMAC that never holds the number", () => {
    const hash = hashDestination(MOBILE, keys.hotelFormAddress);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("9000000001");
  });

  it("is the same for the same number and key, so a limit counts one mobile once", () => {
    expect(hashDestination(MOBILE, keys.hotelFormAddress)).toBe(
      hashDestination(MOBILE, keys.hotelFormAddress),
    );
    expect(hashDestination("+919000000002", keys.hotelFormAddress)).not.toBe(
      hashDestination(MOBILE, keys.hotelFormAddress),
    );
  });

  it("differs under another key, so no other purpose's HMAC of the number matches it", () => {
    expect(hashDestination(MOBILE, keys.otpKey)).not.toBe(
      hashDestination(MOBILE, keys.hotelFormAddress),
    );
  });

  it("refuses anything but an E.164 number, which the caller must normalise first", () => {
    for (const raw of ["9000000001", "+91 90000 00001", "+0123456789", "", "+91900000000123456"]) {
      expect(() => hashDestination(raw, keys.hotelFormAddress), raw).toThrow(/E\.164/);
    }
  });
});
