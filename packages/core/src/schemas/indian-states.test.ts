import { describe, expect, it } from "vitest";

import {
  INDIAN_STATES,
  INDIAN_UNION_TERRITORIES,
  indianState,
  isIndianState,
} from "./indian-states";

/* India's states and union territories (D-190 §2): the list the hotel form's state question offers. */
describe("INDIAN_STATES", () => {
  it("holds the 28 states and the 8 union territories, each once, in alphabetical order", () => {
    expect(INDIAN_STATES).toHaveLength(36);
    expect(new Set(INDIAN_STATES).size).toBe(36);
    expect([...INDIAN_STATES]).toEqual([...INDIAN_STATES].sort((a, b) => a.localeCompare(b, "en")));
    expect(INDIAN_UNION_TERRITORIES).toHaveLength(8);
    for (const territory of INDIAN_UNION_TERRITORIES) expect(INDIAN_STATES).toContain(territory);
  });

  it("names them as the catalogue's destinations do", () => {
    for (const name of ["Rajasthan", "Goa", "Kerala", "Uttarakhand", "Telangana", "Odisha"]) {
      expect(INDIAN_STATES).toContain(name);
    }
    for (const name of ["Delhi", "Ladakh", "Jammu and Kashmir", "Puducherry"]) {
      expect(INDIAN_UNION_TERRITORIES).toContain(name);
    }
    expect(INDIAN_UNION_TERRITORIES).toContain("Dadra and Nagar Haveli and Daman and Diu");
  });

  it("leaves out the old names of states and territories that changed", () => {
    for (const old of [
      "Orissa",
      "Uttaranchal",
      "Pondicherry",
      "Daman and Diu",
      "Dadra and Nagar Haveli",
    ]) {
      expect(isIndianState(old), old).toBe(false);
    }
  });
});

describe("indianState", () => {
  it("takes a name from the list exactly, and nothing else", () => {
    expect(indianState.parse("Rajasthan")).toBe("Rajasthan");
    for (const text of ["rajasthan", " Rajasthan", "RJ", "", "Atlantis"]) {
      expect(indianState.safeParse(text).success, text).toBe(false);
    }
  });

  it("tells a listed name from any other text", () => {
    expect(isIndianState("Goa")).toBe(true);
    expect(isIndianState("goa")).toBe(false);
  });
});
