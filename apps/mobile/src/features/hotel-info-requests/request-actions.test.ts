import { requestFullFixture } from "./info-requests.test-utils";
import { requestActionsFor } from "./request-actions";

/*
 * Which actions a request offers (D-188 §7): Extend only while a whole day still fits between the later
 * of now and the current expiry and the latest expiry the policy allows, as the API's own check does
 * (an extension that lands on that latest expiry is accepted).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-25T10:00:00.000Z");
const at = (ms: number): string => new Date(ms).toISOString();

describe("requestActionsFor: Extend", () => {
  it("offers Extend while one more day fits before the latest expiry, from the current expiry", () => {
    const expiresAt = "2026-12-24T10:00:00.000Z";
    const later = Date.parse(expiresAt);
    const room = requestFullFixture({ expiresAt, extendableUntil: at(later + DAY_MS) });
    expect(requestActionsFor(room, NOW).extend).toBe(true);
    const noRoom = requestFullFixture({ expiresAt, extendableUntil: at(later + DAY_MS - 1) });
    expect(requestActionsFor(noRoom, NOW).extend).toBe(false);
  });

  it("counts from now for a link that has expired", () => {
    const expired = { expiresAt: "2026-11-01T10:00:00.000Z", isExpired: true };
    const halfADay = requestFullFixture({
      ...expired,
      extendableUntil: at(NOW.getTime() + DAY_MS / 2),
    });
    expect(requestActionsFor(halfADay, NOW).extend).toBe(false);
    const twoDays = requestFullFixture({
      ...expired,
      extendableUntil: at(NOW.getTime() + 2 * DAY_MS),
    });
    expect(requestActionsFor(twoDays, NOW).extend).toBe(true);
  });

  it("offers no Extend once nothing extends the request", () => {
    expect(requestActionsFor(requestFullFixture({ extendableUntil: null }), NOW).extend).toBe(
      false,
    );
    const revoked = requestFullFixture({
      status: "revoked",
      extendableUntil: "2099-01-01T10:00:00.000Z",
    });
    expect(requestActionsFor(revoked, NOW).extend).toBe(false);
  });
});
