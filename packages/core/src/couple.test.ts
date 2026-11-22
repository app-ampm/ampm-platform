import { describe, expect, it } from "vitest";

import { coupleSubtitle, coupleTitle } from "./couple.js";

describe("coupleTitle", () => {
  it("names the client after the couple once both names are given", () => {
    expect(coupleTitle({ brideName: "Priya", groomName: "Arjun" })).toBe("Priya & Arjun");
  });

  it("trims each name", () => {
    expect(coupleTitle({ brideName: "  Priya ", groomName: " Arjun Mehta  " })).toBe(
      "Priya & Arjun Mehta",
    );
  });

  it("waits for both names: one alone does not name the client", () => {
    expect(coupleTitle({ brideName: "Priya", groomName: null })).toBeNull();
    expect(coupleTitle({ brideName: null, groomName: "Arjun" })).toBeNull();
    expect(coupleTitle({ brideName: "Priya", groomName: "   " })).toBeNull();
    expect(coupleTitle({ brideName: null, groomName: null })).toBeNull();
  });
});

describe("coupleSubtitle", () => {
  it("shows the couple under a name that is not theirs", () => {
    expect(coupleSubtitle({ name: "Sharma family", coupleNames: "Priya & Arjun" })).toBe(
      "Priya & Arjun",
    );
  });

  it("does not repeat a name that already is the couple's", () => {
    expect(coupleSubtitle({ name: "Priya & Arjun", coupleNames: "Priya & Arjun" })).toBeNull();
    expect(coupleSubtitle({ name: "priya & arjun ", coupleNames: "Priya & Arjun" })).toBeNull();
  });

  it("is empty when no couple is named", () => {
    expect(coupleSubtitle({ name: "Sharma family", coupleNames: null })).toBeNull();
    expect(coupleSubtitle({ name: "Sharma family", coupleNames: " " })).toBeNull();
  });
});
