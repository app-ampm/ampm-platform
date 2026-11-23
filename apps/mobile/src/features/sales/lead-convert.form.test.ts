import { buildConvertRequest, convertCoupleHint, EMPTY_COUPLE } from "./lead-convert.form";

const EMAIL = "rohit@example.com";
const CONTACT = { email: EMAIL, isDecisionMaker: true };

describe("buildConvertRequest", () => {
  it("sends only the contact when no name was typed", () => {
    expect(buildConvertRequest(EMAIL, EMPTY_COUPLE)).toEqual({ primaryContact: CONTACT });
  });

  it("sends each typed name trimmed, and leaves a blank one out", () => {
    const brideOnly = { ...EMPTY_COUPLE, brideName: " Priya ", groomName: "  " };
    expect(buildConvertRequest(EMAIL, brideOnly)).toEqual({
      primaryContact: CONTACT,
      brideName: "Priya",
    });
  });

  it("sends the fathers with the couple", () => {
    const couple = {
      brideName: "Priya",
      brideFatherName: " Rahul Sharma ",
      groomName: "Arjun",
      groomFatherName: "Vikram Mehta",
    };
    expect(buildConvertRequest(EMAIL, couple)).toEqual({
      primaryContact: CONTACT,
      brideName: "Priya",
      brideFatherName: "Rahul Sharma",
      groomName: "Arjun",
      groomFatherName: "Vikram Mehta",
    });
  });
});

describe("convertCoupleHint", () => {
  it("says the names are optional until both are typed", () => {
    expect(convertCoupleHint(EMPTY_COUPLE)).toMatch(/^Optional/);
    expect(convertCoupleHint({ ...EMPTY_COUPLE, brideName: "Priya" })).toMatch(/^Optional/);
  });

  it("names the client the couple will name", () => {
    expect(convertCoupleHint({ ...EMPTY_COUPLE, brideName: "Priya", groomName: "Arjun" })).toBe(
      "The client will be named Priya & Arjun.",
    );
  });
});
