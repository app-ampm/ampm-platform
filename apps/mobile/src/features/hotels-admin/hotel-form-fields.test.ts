import {
  booleanFromTriState,
  facilitiesError,
  intOrNull,
  linesToList,
  listToLines,
  numberOrNull,
  numberRuleError,
  TRI_STATES,
  triStateFrom,
  withoutNul,
  type NumberRule,
} from "./hotel-form-fields";

const KM: NumberRule = { min: 0, max: 999.9, places: 1, message: "Distance is wrong" };
const WHOLE: NumberRule = { min: 1, max: 60, places: 0, message: "Nights are wrong" };
const SIGNED: NumberRule = { min: -90, max: 90, places: 6, message: "Latitude is wrong" };
// Escaped, never the character itself: text pasted from a PDF can carry this invisible one.
const NUL = "\u0000";

describe("hotel-form-fields", () => {
  describe("numberRuleError", () => {
    it("allows a blank entry, since every such field is optional", () => {
      expect(numberRuleError("", KM)).toBeUndefined();
      expect(numberRuleError("   ", WHOLE)).toBeUndefined();
    });

    it("takes numbers within the bounds, with up to the decimals the rule allows", () => {
      expect(numberRuleError("0", KM)).toBeUndefined();
      expect(numberRuleError(" 12.5 ", KM)).toBeUndefined();
      expect(numberRuleError("999.9", KM)).toBeUndefined();
      expect(numberRuleError("60", WHOLE)).toBeUndefined();
      expect(numberRuleError("-12.345678", SIGNED)).toBeUndefined();
    });

    it("refuses extra decimals, values out of bounds and anything that is not a plain number", () => {
      expect(numberRuleError("12.55", KM)).toBe("Distance is wrong");
      expect(numberRuleError("1000", KM)).toBe("Distance is wrong");
      expect(numberRuleError("-1", KM)).toBe("Distance is wrong");
      expect(numberRuleError("2.5", WHOLE)).toBe("Nights are wrong");
      expect(numberRuleError("0", WHOLE)).toBe("Nights are wrong");
      expect(numberRuleError("12.3456789", SIGNED)).toBe("Latitude is wrong");
      for (const entry of ["abc", "1e3", ".5", "5.", "+5", "1,000", "12 km"]) {
        expect(numberRuleError(entry, KM)).toBe("Distance is wrong");
      }
    });
  });

  it("parses a checked entry, or null when blank", () => {
    expect(numberOrNull(" 22.5 ")).toBe(22.5);
    expect(numberOrNull("-73.68")).toBe(-73.68);
    expect(numberOrNull("  ")).toBeNull();
    expect(intOrNull("80")).toBe(80);
  });

  it("turns a list into one line per entry and back, dropping blank lines", () => {
    expect(listToLines(["The Lakeside", "Lakeside Palace Hotel"])).toBe(
      "The Lakeside\nLakeside Palace Hotel",
    );
    expect(listToLines(null)).toBe("");
    expect(linesToList("  The Lakeside \r\n\n Lakeside Palace Hotel\n")).toEqual([
      "The Lakeside",
      "Lakeside Palace Hotel",
    ]);
    expect(linesToList(" \n ")).toBeNull();
  });

  it("reads a list with the import's rule: a | separates two entries, a comma never does", () => {
    expect(linesToList("Spa, salon and gym | Pool\nLawn")).toEqual([
      "Spa, salon and gym",
      "Pool",
      "Lawn",
    ]);
    expect(linesToList(listToLines(["Spa, salon", "Pool"]))).toEqual(["Spa, salon", "Pool"]);
  });

  it("drops the null character from a sheet's text, and checks the facilities a sheet sends", () => {
    expect(withoutNul(`Seated${NUL} 300${NUL}`)).toBe("Seated 300");
    const hundred = Array.from({ length: 100 }, (_, i) => `Synthetic amenity ${i}`).join("\n");
    expect(facilitiesError(`${hundred}\n${NUL}`)).toBeUndefined();
    expect(facilitiesError(`${hundred}\nSpa`)).toBe("Keep to 100 facilities, one per line");
  });

  it("keeps not known apart from no: null is unknown, never false", () => {
    expect(TRI_STATES).toEqual(["unknown", "yes", "no"]);
    expect(triStateFrom(null)).toBe("unknown");
    expect(triStateFrom(true)).toBe("yes");
    expect(triStateFrom(false)).toBe("no");
    expect(booleanFromTriState("unknown")).toBeNull();
    expect(booleanFromTriState("yes")).toBe(true);
    expect(booleanFromTriState("no")).toBe(false);
  });
});
