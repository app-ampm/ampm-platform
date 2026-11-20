import { describe, expect, it } from "vitest";

import {
  generateOneTimeCode,
  hashOneTimeCode,
  ONE_TIME_CODE_TTL_MS,
  oneTimeCodeMatches,
} from "./one-time-code.js";

const KEY = Buffer.alloc(32, 7);
const OTHER_KEY = Buffer.alloc(32, 9);

describe("one-time codes (D-147)", () => {
  it("are six digits, leading zeros kept, and live five minutes", () => {
    for (let i = 0; i < 50; i += 1) expect(generateOneTimeCode()).toMatch(/^\d{6}$/);
    expect(ONE_TIME_CODE_TTL_MS).toBe(300_000);
  });

  it("are kept as an HMAC bound to the account and the key", () => {
    const hash = hashOneTimeCode("user-1", "012345", KEY);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("012345");
    expect(hashOneTimeCode("user-2", "012345", KEY)).not.toBe(hash);
    expect(hashOneTimeCode("user-1", "012345", OTHER_KEY)).not.toBe(hash);
  });

  it("match only the right code for the right account", () => {
    const stored = hashOneTimeCode("user-1", "654321", KEY);
    expect(oneTimeCodeMatches("user-1", "654321", stored, KEY)).toBe(true);
    expect(oneTimeCodeMatches("user-1", "654320", stored, KEY)).toBe(false);
    expect(oneTimeCodeMatches("user-2", "654321", stored, KEY)).toBe(false);
    expect(oneTimeCodeMatches("user-1", "654321", "not-a-hash", KEY)).toBe(false);
  });
});
