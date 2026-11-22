import { describe, expect, it } from "vitest";

import { withCoupleNaming } from "./account-patches.js";

const LEAD_NAMED = {
  name: "Rahul Sharma",
  coupleNames: null,
  brideName: null,
  groomName: null,
};
const COUPLE_NAMED = {
  name: "Priya & Arjun",
  coupleNames: "Priya & Arjun",
  brideName: "Priya",
  groomName: "Arjun",
};

describe("withCoupleNaming", () => {
  it("renames the client after the couple once the bride and groom are both given", () => {
    expect(withCoupleNaming(LEAD_NAMED, { brideName: "Priya", groomName: "Arjun" })).toEqual({
      brideName: "Priya",
      groomName: "Arjun",
      name: "Priya & Arjun",
      coupleNames: "Priya & Arjun",
    });
  });

  it("completes the couple from the name already on the account", () => {
    const current = { ...LEAD_NAMED, brideName: "Priya" };
    expect(withCoupleNaming(current, { groomName: "Arjun" })).toMatchObject({
      name: "Priya & Arjun",
      coupleNames: "Priya & Arjun",
    });
  });

  it("follows a corrected name, overriding a name the same edit sent", () => {
    expect(withCoupleNaming(COUPLE_NAMED, { groomName: "Rohan", name: "Something else" })).toEqual({
      groomName: "Rohan",
      name: "Priya & Rohan",
      coupleNames: "Priya & Rohan",
    });
  });

  it("keeps the name while only one of the couple is given", () => {
    expect(withCoupleNaming(LEAD_NAMED, { brideName: "Priya" })).toEqual({ brideName: "Priya" });
  });

  it("clears a couple line that followed the couple when one name is cleared, keeping the name", () => {
    expect(withCoupleNaming(COUPLE_NAMED, { groomName: null })).toEqual({
      groomName: null,
      coupleNames: null,
    });
  });

  it("keeps a couple line staff typed themselves when the couple is incomplete", () => {
    const current = { ...LEAD_NAMED, coupleNames: "Riya & Kabir" };
    expect(withCoupleNaming(current, { brideName: "Riya" })).toEqual({ brideName: "Riya" });
  });

  it("leaves an edit that does not touch the couple alone, fathers included", () => {
    const patch = { brideFatherName: "Rahul Sharma", name: "Sharma family" };
    expect(withCoupleNaming(COUPLE_NAMED, patch)).toBe(patch);
  });

  it("leaves out the name and couple line when they would not change", () => {
    expect(withCoupleNaming(COUPLE_NAMED, { brideName: "Priya" })).toEqual({ brideName: "Priya" });
  });
});
