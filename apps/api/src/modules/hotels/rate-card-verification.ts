import type { HotelVerificationFieldGroup, HotelVerificationStatus } from "@ampm/core";

/*
 * Which verification may back a verified rate card (AC-04.1, AC-04.3, AC-04.4). Pure, so it tests in
 * isolation; the service applies it, with the freshness window the nightly sweep uses
 * (`configurations.hotel.verification_policy.maxAgeDays`).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
/** The clock drift tolerated before a verification counts as dated in the future. */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

/** The parts of a verification the rule reads. */
export interface VerificationFacts {
  readonly fieldGroup: HotelVerificationFieldGroup;
  readonly status: HotelVerificationStatus;
  readonly verifiedAt: Date | null;
}

/** Whether a verification's date lies ahead of the server's clock, beyond a few minutes of drift. */
export function isFutureDated(verifiedAt: Date, now: Date): boolean {
  return verifiedAt.getTime() > now.getTime() + FUTURE_TOLERANCE_MS;
}

/**
 * Why a verification cannot back a verified rate card, or null when it can. It must record the rates, be
 * verified (not stale or unverified) and be dated inside the freshness window, never ahead of the clock:
 * only then does the nightly sweep stale the card on time, since the sweep revisits only verifications
 * still `verified`, by their date. Anything else would leave a card "verified" that the sweep never
 * stales.
 *
 * @example
 * rateCardVerificationProblem({ fieldGroup: "profile", status: "verified", verifiedAt }, now, 90);
 * // "A rate card can only be verified against a rates verification"
 */
export function rateCardVerificationProblem(
  verification: VerificationFacts,
  now: Date,
  maxAgeDays: number,
): string | null {
  const { fieldGroup, status, verifiedAt } = verification;
  if (fieldGroup !== "rates")
    return "A rate card can only be verified against a rates verification";
  if (status !== "verified" || verifiedAt === null) {
    return "That verification is stale or unverified; record a new rates verification";
  }
  if (isFutureDated(verifiedAt, now)) {
    return "That verification is dated in the future; record a new rates verification";
  }
  // The sweep's own comparison: older than the cutoff is stale.
  if (verifiedAt.getTime() < now.getTime() - maxAgeDays * DAY_MS) {
    return `That verification is older than ${maxAgeDays} days; record a new rates verification`;
  }
  return null;
}
