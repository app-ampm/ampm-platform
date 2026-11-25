import { errors, HOTEL_FORM_ERRORS } from "@ampm/core";
import { describe, expect, it } from "vitest";

import { hashDestination } from "../../../identity/destination-hash.js";
import {
  FORM_IP,
  FORM_KEYS,
  FORM_MOBILE,
  FORM_NOW,
  FORM_REQUEST_ID,
  linkedRequest,
  refusalOf,
} from "../testing/hotel-form-fixtures.js";
import {
  BODY,
  buildIssuer as build,
  issueWith as issue,
} from "../testing/hotel-form-issuer-harness.js";

/*
 * What a code request is refused for (D-189 §2 to §4): a stale notice, a failed bot check, a removed
 * mobile, a locked mobile, any limit, and a link that is not active; each before anything is stored.
 */

describe("HotelFormCodeIssuer refusals", () => {
  it("refuses a stale notice with D-189's words, before the bot check", async () => {
    const built = build();
    const refused = await refusalOf(
      issue(built, { ...BODY, noticeVersion: "hf-notice-2026-01-01" }),
    );
    expect(refused?.status).toBe(409);
    expect(refused?.message).toBe("The form was updated. Reload the page.");
    expect(built.verify).not.toHaveBeenCalled();
    expect(built.created).toEqual([]);
  });

  it("checks the bot token for the site's host and the hf_code action, refusing a failed one", async () => {
    const built = build({ human: false });
    const refused = await refusalOf(issue(built));
    expect(built.verify).toHaveBeenCalledWith("turnstile-pass", {
      remoteIp: FORM_IP,
      expectedHostnames: ["site.synthetic.example"],
      expectedAction: "hf_code",
    });
    expect(refused?.status).toBe(400);
    expect(refused?.details).toEqual([{ path: "botToken", message: HOTEL_FORM_ERRORS.botCheck }]);
    expect(built.limits.allowCodeRequest).not.toHaveBeenCalled();
  });

  it("refuses a mobile AMPM removed from this request with 403, issuing no code", async () => {
    const built = build({ removed: true });
    const refused = await refusalOf(issue(built));
    expect(refused?.status).toBe(403);
    expect(refused?.message).toBe(HOTEL_FORM_ERRORS.mobileRemoved);
    expect(built.created).toEqual([]);
    expect(built.limits.allowCodeRequest).not.toHaveBeenCalled();
  });

  it("lets a mobile through whose live person is there, even if an earlier one was removed", async () => {
    const built = build({ removed: true, live: true });
    expect((await issue(built)).result.delivery).toBe("screen");
  });

  it("refuses a locked mobile for the rest of its hour, with Retry-After", async () => {
    const minutesAgo = (minutes: number) => new Date(FORM_NOW.getTime() - minutes * 60_000);
    const burns = [5, 15, 25].map((minutes) => ({
      createdAt: minutesAgo(minutes + 2),
      retiredAt: minutesAgo(minutes),
    }));
    const built = build({ burns });
    const refused = await refusalOf(issue(built));
    expect(refused?.status).toBe(429);
    expect(refused?.message).toBe(HOTEL_FORM_ERRORS.mobileLocked);
    expect(refused?.retryAfterSeconds).toBe(55 * 60);
    expect(built.challenges.recentBurns).toHaveBeenCalledWith(
      FORM_REQUEST_ID,
      hashDestination(FORM_MOBILE, FORM_KEYS.hotelFormAddress),
      new Date(FORM_NOW.getTime() - 2 * 60 * 60_000),
    );
    expect(built.created).toEqual([]);
  });

  it("counts every limit by network, mobile hash and request, and stores nothing when one refuses", async () => {
    const built = build();
    built.limits.allowCodeRequest.mockRejectedValueOnce(
      errors.rateLimited(HOTEL_FORM_ERRORS.tooSoon, 20),
    );
    const refused = await refusalOf(issue(built));
    expect(built.limits.allowCodeRequest).toHaveBeenCalledWith({
      ip: FORM_IP,
      destinationHash: hashDestination(FORM_MOBILE, FORM_KEYS.hotelFormAddress),
      requestId: FORM_REQUEST_ID,
    });
    expect(refused?.status).toBe(429);
    expect(built.created).toEqual([]);
  });

  it("refuses a link that is not active with 404", async () => {
    const built = build();
    built.repository.findByLinkHash.mockResolvedValueOnce(linkedRequest({ status: "revoked" }));
    const refused = await refusalOf(issue(built));
    expect(refused?.status).toBe(404);
    expect(refused?.message).toBe(HOTEL_FORM_ERRORS.notActive);
  });
});
