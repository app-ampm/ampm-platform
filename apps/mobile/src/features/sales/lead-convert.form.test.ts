import { buildConvertRequest, convertCoupleHint, EMPTY_COUPLE } from "./lead-convert.form";

const EMAIL = "rohit@example.com";
const CONTACT = { email: EMAIL, isDecisionMaker: true };

describe("buildConvertRequest", () => {
  it("sends only the contact when no name was typed", () => {
    expect(buildConvertRequest(EMAIL, EMPTY_COUPLE)).toEqual({ primaryContact: CONTACT });
  });

  it("sends each typed name trimmed, and leaves a blank one out", () => {
    expect(buildConvertRequest(EMAIL, { brideName: " Priya ", groomName: "  " })).toEqual({
      primaryContact: CONTACT,
      brideName: "Priya",
    });
    expect(buildConvertRequest(EMAIL, { brideName: "Priya", groomName: "Arjun" })).toEqual({
      primaryContact: CONTACT,
      brideName: "Priya",
      groomName: "Arjun",
    });
  });
});

describe("convertCoupleHint", () => {
  it("says the names are optional until both are typed", () => {
    expect(convertCoupleHint(EMPTY_COUPLE)).toMatch(/^Optional/);
    expect(convertCoupleHint({ brideName: "Priya", groomName: "" })).toMatch(/^Optional/);
  });

  it("names the client the couple will name", () => {
    expect(convertCoupleHint({ brideName: "Priya", groomName: "Arjun" })).toBe(
      "The client will be named Priya & Arjun.",
    );
  });
});
