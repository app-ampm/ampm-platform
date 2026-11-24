import { describe, expect, it } from "vitest";

import { rc4 } from "./rc4.js";

describe("rc4", () => {
  it.each([
    ["Key", "Plaintext", "bbf316e8d940af0ad3"],
    ["Wiki", "pedia", "1021bf0420"],
    ["Secret", "Attack at dawn", "45a01f645fc35b383552544b9bf5"],
  ])("matches the published vector for key %s", (key, plain, cipher) => {
    expect(rc4(Buffer.from(key), Buffer.from(plain)).toString("hex")).toBe(cipher);
  });

  it("decrypts what it encrypts", () => {
    const key = Buffer.from("0123456789abcdef", "hex");
    const text = Buffer.from("Sample Hotel, Banquet Hall A");
    expect(rc4(key, rc4(key, text)).equals(text)).toBe(true);
  });
});
