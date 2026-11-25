import {
  HOTEL_FORM_MOBILE_REFUSAL,
  HOTEL_FORM_NOTICE_VERSION,
  type HotelFormPerson,
} from "@ampm/core";
import { describe, expect, it } from "vitest";

import { codeStep, resendDeadline, spokenMobile } from "./code.form";
import { EMPTY_DETAILS, designationOf, detailsFromPerson, detailsStep } from "./details.form";
import { HOTEL_FORM_COPY } from "./hotel-form-copy";
import { meChangeStep } from "./person.form";

/* The identity step's pure helpers (D-175: useState, `*.form` helpers and core's schemas). */

const LINK = `hfl_${"x".repeat(43)}`;
const CHALLENGE = "0192f3a0-7d3e-7b1a-9c2f-123456789abc";
const FILLED = {
  ...EMPTY_DETAILS,
  fullName: "  Asha Rao ",
  designationChoice: "General Manager",
  mobile: "70000 01234",
  noticeAccepted: true,
};

describe("the designation", () => {
  it("is the chosen one, or the words typed after Other", () => {
    expect(designationOf(FILLED)).toBe("General Manager");
    expect(
      designationOf({ ...FILLED, designationChoice: "Other", designationOther: "Chief Engineer" }),
    ).toBe("Chief Engineer");
  });

  it("is Other itself while nothing is typed after it, which the schema refuses", () => {
    expect(designationOf({ ...FILLED, designationChoice: "Other", designationOther: "  " })).toBe(
      "Other",
    );
  });

  it("comes back to the fields from a person's stored details", () => {
    const listed: HotelFormPerson = { fullName: "Asha Rao", designation: "Sales Manager" };
    expect(detailsFromPerson(listed)).toMatchObject({
      fullName: "Asha Rao",
      designationChoice: "Sales Manager",
      designationOther: "",
      mobile: "",
      noticeAccepted: false,
    });
    expect(detailsFromPerson({ fullName: "Ravi", designation: "Chief Engineer" })).toMatchObject({
      designationChoice: "Other",
      designationOther: "Chief Engineer",
    });
  });
});

describe("asking for a code (HF-02)", () => {
  it("sends the claim with the notice version and the bot check's token", () => {
    expect(detailsStep(FILLED, LINK, "bot-token")).toEqual({
      kind: "send",
      request: {
        token: LINK,
        fullName: "Asha Rao",
        designation: "General Manager",
        mobile: "+917000001234",
        noticeVersion: HOTEL_FORM_NOTICE_VERSION,
        botToken: "bot-token",
      },
    });
  });

  it("names every missing answer on its field, with core's messages", () => {
    const step = detailsStep(EMPTY_DETAILS, LINK, null);
    expect(step).toEqual({
      kind: "invalid",
      errors: {
        fullName: "Enter your name",
        designationChoice: "Choose your designation",
        mobile: HOTEL_FORM_MOBILE_REFUSAL,
        notice: HOTEL_FORM_COPY.details.noticeRequired,
      },
    });
  });

  it("puts Other's missing words on the field that asks for them", () => {
    const step = detailsStep(
      { ...FILLED, designationChoice: "Other", designationOther: "" },
      LINK,
      "bot-token",
    );
    expect(step).toEqual({
      kind: "invalid",
      errors: { designationOther: "Enter your designation" },
    });
  });

  it("refuses a mobile that is not Indian", () => {
    expect(detailsStep({ ...FILLED, mobile: "+44 7700 900123" }, LINK, "t")).toEqual({
      kind: "invalid",
      errors: { mobile: HOTEL_FORM_MOBILE_REFUSAL },
    });
  });

  it("waits for the bot check once the answers are complete", () => {
    expect(detailsStep(FILLED, LINK, null)).toEqual({ kind: "wait" });
  });
});

describe("entering the code (HF-03)", () => {
  it("sends six digits for the challenge, and asks for six otherwise", () => {
    expect(codeStep("482917", LINK, CHALLENGE)).toEqual({
      kind: "send",
      request: { token: LINK, challengeId: CHALLENGE, oneTimeCode: "482917" },
    });
    expect(codeStep("4829", LINK, CHALLENGE)).toEqual({
      kind: "invalid",
      error: "Enter the 6-digit code",
    });
  });

  it("counts the resend wait on this device, never longer than a minute", () => {
    const now = Date.parse("2026-11-25T10:00:00.000Z");
    expect(resendDeadline({ resendAfter: "2026-11-25T10:00:30.000Z" }, now)).toBe(now + 30_000);
    // A device clock far behind the API's would otherwise make the person wait for hours.
    expect(resendDeadline({ resendAfter: "2026-11-25T13:00:00.000Z" }, now)).toBe(now + 60_000);
    expect(resendDeadline({ resendAfter: "2026-11-25T09:59:00.000Z" }, now)).toBe(now);
  });

  it("says the masked mobile as its last digits", () => {
    expect(spokenMobile("+91 ••••• •1234")).toBe("your mobile number ending in 1234");
    expect(spokenMobile("•••")).toBeUndefined();
  });
});

describe("changing your own details", () => {
  const person: HotelFormPerson = { fullName: "Asha Rao", designation: "General Manager" };

  it("sends only what changed", () => {
    const fields = { ...detailsFromPerson(person), designationChoice: "Director of Sales" };
    expect(meChangeStep(fields, person)).toEqual({
      kind: "send",
      change: { designation: "Director of Sales" },
    });
    expect(meChangeStep({ ...detailsFromPerson(person), fullName: "Asha R." }, person)).toEqual({
      kind: "send",
      change: { fullName: "Asha R." },
    });
  });

  it("has nothing to send when nothing changed", () => {
    expect(meChangeStep(detailsFromPerson(person), person)).toEqual({ kind: "unchanged" });
  });

  it("names an emptied answer on its field", () => {
    expect(meChangeStep({ ...detailsFromPerson(person), fullName: " " }, person)).toEqual({
      kind: "invalid",
      errors: { fullName: "Enter your name" },
    });
  });
});
