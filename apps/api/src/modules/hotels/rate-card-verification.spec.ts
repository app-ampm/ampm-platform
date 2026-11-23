import { describe, expect, it } from "vitest";

import {
  isFutureDated,
  rateCardVerificationProblem,
  verificationNextDueAt,
} from "./rate-card-verification.js";

const NOW = new Date("2026-11-23T10:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY);
const current = { fieldGroup: "rates", status: "verified", verifiedAt: daysAgo(10) } as const;

describe("rateCardVerificationProblem", () => {
  it("accepts a rates verification that is verified and inside the window", () => {
    expect(rateCardVerificationProblem(current, NOW, 90)).toBeNull();
    // On the window's last day it still counts; the sweep stales only what is older than the cutoff.
    expect(
      rateCardVerificationProblem({ ...current, verifiedAt: daysAgo(90) }, NOW, 90),
    ).toBeNull();
  });

  it("refuses another field group's verification", () => {
    expect(rateCardVerificationProblem({ ...current, fieldGroup: "profile" }, NOW, 90)).toBe(
      "A rate card can only be verified against a rates verification",
    );
  });

  it("refuses a stale or an unverified one", () => {
    const message = "That verification is stale or unverified; record a new rates verification";
    expect(rateCardVerificationProblem({ ...current, status: "stale" }, NOW, 90)).toBe(message);
    expect(
      rateCardVerificationProblem({ ...current, status: "unverified", verifiedAt: null }, NOW, 90),
    ).toBe(message);
  });

  it("refuses one older than the window, though the sweep has not staled it yet", () => {
    expect(rateCardVerificationProblem({ ...current, verifiedAt: daysAgo(91) }, NOW, 90)).toBe(
      "That verification is older than 90 days; record a new rates verification",
    );
  });

  it("refuses one dated in the future", () => {
    expect(
      rateCardVerificationProblem(
        { ...current, verifiedAt: new Date(NOW.getTime() + DAY) },
        NOW,
        90,
      ),
    ).toBe("That verification is dated in the future; record a new rates verification");
  });
});

describe("isFutureDated", () => {
  it("allows a few minutes of clock drift, no more", () => {
    expect(isFutureDated(new Date(NOW.getTime() + 60 * 1000), NOW)).toBe(false);
    expect(isFutureDated(new Date(NOW.getTime() + 10 * 60 * 1000), NOW)).toBe(true);
    expect(isFutureDated(daysAgo(1), NOW)).toBe(false);
  });
});

describe("verificationNextDueAt", () => {
  it("falls due one freshness window after the verification's own date", () => {
    expect(verificationNextDueAt(NOW, 90)).toEqual(new Date(NOW.getTime() + 90 * DAY));
    expect(verificationNextDueAt(daysAgo(10), 90)).toEqual(new Date(NOW.getTime() + 80 * DAY));
    expect(verificationNextDueAt(NOW, 30).toISOString()).toBe("2026-12-23T10:00:00.000Z");
  });

  it("is the moment the sweep starts refusing the verification for a rate card", () => {
    const verifiedAt = daysAgo(90);
    const due = verificationNextDueAt(verifiedAt, 90);
    const verification = { ...current, verifiedAt };
    expect(rateCardVerificationProblem(verification, due, 90)).toBeNull();
    expect(rateCardVerificationProblem(verification, new Date(due.getTime() + 1), 90)).toMatch(
      /older than 90 days/,
    );
  });
});
