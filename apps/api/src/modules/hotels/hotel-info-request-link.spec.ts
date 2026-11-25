import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  addDays,
  expiryForEmail,
  hashLinkSecret,
  hotelFormLinkUrl,
  mintLinkSecret,
} from "./hotel-info-request-link.js";

/* A hotel information request's link (D-188 §4): the secret, its stored hash, the URL and the expiry. */
describe("the hotel form link", () => {
  it("mints hfl_ and the base64url of 32 random bytes, and only its SHA-256 is to be stored", () => {
    const { secret, hash } = mintLinkSecret();
    expect(secret).toMatch(/^hfl_[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(secret.slice(4), "base64url")).toHaveLength(32);
    expect(hash).toBe(createHash("sha256").update(secret).digest("hex"));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(secret.slice(4));
  });

  it("never mints the same secret twice", () => {
    const secrets = new Set(Array.from({ length: 50 }, () => mintLinkSecret().secret));
    expect(secrets.size).toBe(50);
  });

  it("hashes a secret the same way every time, and two secrets differently", () => {
    const { secret, hash } = mintLinkSecret();
    expect(hashLinkSecret(secret)).toBe(hash);
    expect(hashLinkSecret(mintLinkSecret().secret)).not.toBe(hash);
  });

  it("puts the secret in the fragment of the public website's hotel form page", () => {
    const url = hotelFormLinkUrl("https://site.synthetic.example", "hfl_abc");
    expect(url).toBe("https://site.synthetic.example/hotel-form#k=hfl_abc");
    expect(new URL(url).pathname).toBe("/hotel-form");
    expect(new URL(url).search).toBe("");
  });

  it("adds whole days", () => {
    expect(addDays(new Date("2026-11-24T10:00:00Z"), 30).toISOString()).toBe(
      "2026-12-24T10:00:00.000Z",
    );
  });

  it("writes the expiry for the email in India's time, with the zone named", () => {
    expect(expiryForEmail(new Date("2026-12-24T10:00:00Z"))).toBe("24 December 2026, 15:30 IST");
    expect(expiryForEmail(new Date("2026-12-24T20:00:00Z"))).toBe("25 December 2026, 01:30 IST");
  });
});
