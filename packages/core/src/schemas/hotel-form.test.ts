import { describe, expect, it } from "vitest";

import {
  HOTEL_FORM_DESIGNATION_MAX,
  HOTEL_FORM_DESIGNATIONS,
  HOTEL_FORM_MOBILE_REFUSAL,
  HOTEL_FORM_NAME_MAX,
  HOTEL_FORM_NOTICE_VERSION,
  HOTEL_FORM_OTHER_DESIGNATION,
  hotelFormCodeIssued,
  hotelFormCodeRequest,
  hotelFormDesignation,
  hotelFormLinkState,
  hotelFormMe,
  hotelFormMeUpdateRequest,
  hotelFormMobile,
  hotelFormOpenAnswer,
  hotelFormOpenRequest,
  hotelFormRequestStatus,
  hotelFormSessionToken,
  hotelFormStateOf,
  hotelFormVerified,
  hotelFormVerifyRequest,
} from "./hotel-form";

/*
 * The hotel form's public contracts (D-189 §4): what the site sends to /hotel-form and what it gets back.
 * Every body is strict; nothing about the hotel is in any answer. Synthetic data only: reserved test
 * mobiles (+91 70000 0XXXX) and made-up names.
 */

const TOKEN = `hfl_${"A".repeat(43)}`;
const SESSION = `hfs_${"b".repeat(43)}`;
const CHALLENGE = "0192f1a0-0000-7000-8000-0000000000c1";

const claim = {
  token: TOKEN,
  fullName: "  Synthetic Person  ",
  designation: "General Manager",
  mobile: "+91 70000 01234",
  noticeVersion: HOTEL_FORM_NOTICE_VERSION,
  botToken: "turnstile-pass",
};

describe("the hotel form's words", () => {
  it("lists the designations of D-189 §4, Other last", () => {
    expect(HOTEL_FORM_DESIGNATIONS).toEqual([
      "General Manager",
      "Director of Sales",
      "Sales Manager",
      "Revenue Manager",
      "Front Office Manager",
      "Banquet or Events Manager",
      "Other",
    ]);
    expect(HOTEL_FORM_DESIGNATIONS.at(-1)).toBe(HOTEL_FORM_OTHER_DESIGNATION);
  });

  it("names the notice version a consent records, short enough for its column", () => {
    expect(HOTEL_FORM_NOTICE_VERSION).toMatch(/^hf-notice-\d{4}-\d{2}-\d{2}$/);
    expect(HOTEL_FORM_NOTICE_VERSION.length).toBeLessThanOrEqual(64);
  });

  it("names the link's states and the statuses a signed-in person can see", () => {
    expect(hotelFormLinkState.options).toEqual(["ready", "locked", "status_only", "not_active"]);
    expect(hotelFormRequestStatus.options).toEqual([
      "open",
      "submitted",
      "in_review",
      "changes_requested",
      "merged",
    ]);
  });

  it("reads a status as the state the page shows", () => {
    expect(hotelFormStateOf("open")).toBe("ready");
    expect(hotelFormStateOf("changes_requested")).toBe("ready");
    expect(hotelFormStateOf("submitted")).toBe("locked");
    expect(hotelFormStateOf("in_review")).toBe("locked");
    expect(hotelFormStateOf("merged")).toBe("status_only");
  });
});

describe("hotelFormMobile", () => {
  it("writes an Indian mobile in E.164 however it is typed", () => {
    for (const typed of [
      "7000001234",
      "+91 70000 01234",
      "+91-70000-01234",
      "07000001234",
      "917000001234",
      "(+91) 70000 01234",
    ]) {
      expect(hotelFormMobile.parse(typed)).toBe("+917000001234");
    }
  });

  it("refuses anything that is not an Indian mobile, with one message", () => {
    for (const typed of [
      "",
      "12345",
      "+44 7700 900123",
      "+91 1412345678",
      "5000001234",
      "70000x1234",
    ]) {
      const result = hotelFormMobile.safeParse(typed);
      expect(result.success, typed).toBe(false);
      expect(result.error?.issues.map((issue) => issue.message)).toEqual([
        HOTEL_FORM_MOBILE_REFUSAL,
      ]);
    }
  });
});

describe("hotelFormDesignation", () => {
  it("takes a listed designation or what the person typed after Other, trimmed", () => {
    expect(hotelFormDesignation.parse("Revenue Manager")).toBe("Revenue Manager");
    expect(hotelFormDesignation.parse("  Chief Engineer ")).toBe("Chief Engineer");
  });

  it("refuses Other itself, an empty value and one too long", () => {
    expect(hotelFormDesignation.safeParse("Other").success).toBe(false);
    expect(hotelFormDesignation.safeParse(" other ").success).toBe(false);
    expect(hotelFormDesignation.safeParse("   ").success).toBe(false);
    expect(hotelFormDesignation.safeParse("x".repeat(HOTEL_FORM_DESIGNATION_MAX + 1)).success).toBe(
      false,
    );
  });
});

describe("the request bodies", () => {
  it("open takes the link's token alone", () => {
    expect(hotelFormOpenRequest.parse({ token: TOKEN })).toEqual({ token: TOKEN });
    expect(hotelFormOpenRequest.safeParse({ token: TOKEN, hotelId: CHALLENGE }).success).toBe(
      false,
    );
    expect(hotelFormOpenRequest.safeParse({ token: "" }).success).toBe(false);
    expect(hotelFormOpenRequest.safeParse({ token: "x".repeat(129) }).success).toBe(false);
  });

  it("a code request takes the claim, the notice version and the bot token", () => {
    expect(hotelFormCodeRequest.parse(claim)).toEqual({
      ...claim,
      fullName: "Synthetic Person",
      mobile: "+917000001234",
    });
  });

  it("a code request refuses an unknown field, a long name and a missing notice version", () => {
    expect(hotelFormCodeRequest.safeParse({ ...claim, personId: CHALLENGE }).success).toBe(false);
    const long = { ...claim, fullName: "x".repeat(HOTEL_FORM_NAME_MAX + 1) };
    expect(hotelFormCodeRequest.safeParse(long).success).toBe(false);
    const { noticeVersion: _dropped, ...noNotice } = claim;
    expect(hotelFormCodeRequest.safeParse(noNotice).success).toBe(false);
  });

  it("leaves a missing bot token to the bot check, which refuses it", () => {
    const { botToken: _dropped, ...noBot } = claim;
    expect(hotelFormCodeRequest.safeParse(noBot).success).toBe(true);
  });

  it("verify takes the link's token, the challenge and a six-digit code", () => {
    const body = { token: TOKEN, challengeId: CHALLENGE, oneTimeCode: "012345" };
    expect(hotelFormVerifyRequest.parse(body)).toEqual(body);
    expect(hotelFormVerifyRequest.safeParse({ ...body, oneTimeCode: "12345" }).success).toBe(false);
    expect(hotelFormVerifyRequest.safeParse({ ...body, challengeId: "c1" }).success).toBe(false);
    expect(hotelFormVerifyRequest.safeParse({ ...body, mobile: "7000001234" }).success).toBe(false);
  });

  it("a change of your own details takes a name or a designation, never a mobile", () => {
    expect(hotelFormMeUpdateRequest.parse({ fullName: " New Name " })).toEqual({
      fullName: "New Name",
    });
    expect(hotelFormMeUpdateRequest.parse({ designation: "Sales Manager" })).toEqual({
      designation: "Sales Manager",
    });
    expect(hotelFormMeUpdateRequest.safeParse({}).success).toBe(false);
    expect(hotelFormMeUpdateRequest.safeParse({ mobile: "7000001234" }).success).toBe(false);
  });
});

describe("the answers", () => {
  const view = {
    personId: "0192f3a0-7d3e-7b1a-9c2f-0000000000a5",
    person: { fullName: "Synthetic Person", designation: "General Manager" },
    request: {
      displayLabel: "Monsoon refresh",
      staffNote: null,
      status: "open",
      expiresAt: "2026-12-25T10:00:00.000Z",
    },
    photoPermission: "none",
  } as const;

  it("open answers the state, the expiry and the help contact, and nothing about the hotel", () => {
    const answer = { state: "ready", expiresAt: "2026-12-25T10:00:00.000Z", helpContact: null };
    expect(hotelFormOpenAnswer.parse(answer)).toEqual(answer);
    expect(hotelFormOpenAnswer.safeParse({ ...answer, hotelName: "Synthetic" }).success).toBe(
      false,
    );
    expect(hotelFormOpenAnswer.parse({ ...answer, state: "not_active", expiresAt: null })).toEqual({
      ...answer,
      state: "not_active",
      expiresAt: null,
    });
  });

  it("a code answer carries the code in on-screen mode only", () => {
    const fields = {
      challengeId: CHALLENGE,
      maskedMobile: "+91 ••••• •1234",
      expiresAt: "2026-11-25T10:05:00.000Z",
      resendAfter: "2026-11-25T10:00:30.000Z",
    };
    expect(hotelFormCodeIssued.parse({ ...fields, delivery: "screen", code: "012345" })).toEqual({
      ...fields,
      delivery: "screen",
      code: "012345",
    });
    expect(hotelFormCodeIssued.parse({ ...fields, delivery: "sms" })).toEqual({
      ...fields,
      delivery: "sms",
    });
    expect(
      hotelFormCodeIssued.safeParse({ ...fields, delivery: "sms", code: "012345" }).success,
    ).toBe(false);
    expect(hotelFormCodeIssued.safeParse({ ...fields, delivery: "screen" }).success).toBe(false);
  });

  it("verify answers the session, the person and the request; me the person and the request", () => {
    expect(hotelFormVerified.parse({ ...view, sessionToken: SESSION })).toEqual({
      ...view,
      sessionToken: SESSION,
    });
    expect(hotelFormMe.parse(view)).toEqual(view);
    // The person's id, which tells the page whether a new code signed the same person in again.
    const { personId: _id, ...noId } = view;
    expect(hotelFormMe.safeParse(noId).success).toBe(false);
    expect(hotelFormMe.safeParse({ ...view, personId: "asha" }).success).toBe(false);
    expect(
      hotelFormMe.safeParse({ ...view, person: { ...view.person, phone: "+917000001234" } })
        .success,
    ).toBe(false);
  });

  it("me and verify carry the person's own answer to 7.5: yes, no, or none on record", () => {
    for (const photoPermission of ["yes", "no", "none"] as const) {
      expect(hotelFormMe.parse({ ...view, photoPermission }).photoPermission).toBe(photoPermission);
      expect(
        hotelFormVerified.parse({ ...view, photoPermission, sessionToken: SESSION })
          .photoPermission,
      ).toBe(photoPermission);
    }
    const { photoPermission: _answer, ...noAnswer } = view;
    expect(hotelFormMe.safeParse(noAnswer).success).toBe(false);
    expect(hotelFormMe.safeParse({ ...view, photoPermission: "withdrawn" }).success).toBe(false);
    expect(hotelFormMe.safeParse({ ...view, photoPermission: true }).success).toBe(false);
  });

  it("a session token is hfs_ and 43 base64url characters", () => {
    expect(hotelFormSessionToken.safeParse(SESSION).success).toBe(true);
    expect(hotelFormSessionToken.safeParse(`hfl_${"b".repeat(43)}`).success).toBe(false);
    expect(hotelFormSessionToken.safeParse(`hfs_${"b".repeat(42)}`).success).toBe(false);
  });
});
