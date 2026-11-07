import {
  amountError,
  dateError,
  errorMessage,
  FEE_STRUCTURE_OPTIONS,
  feeStructureLabel,
  isIsoDate,
  isoDateTimeFromDate,
  MILESTONE_TYPE_OPTIONS,
  moneyFromRupees,
  RATE_ITEM_OPTIONS,
  rateItemLabel,
  rupeesToMinor,
  textError,
} from "./consultancy-admin.form";

describe("rupeesToMinor", () => {
  it("reads Indian grouping, spaces and the rupee sign as whole paise", () => {
    expect(rupeesToMinor("12,50,000")).toBe(125_000_000);
    expect(rupeesToMinor("₹ 1,000")).toBe(100_000);
  });

  it("keeps up to two decimal places as integers, with no floating point", () => {
    expect(rupeesToMinor("1250000.5")).toBe(125_000_050);
    expect(rupeesToMinor("0.07")).toBe(7);
  });

  it("rejects anything that is not a non-negative amount with at most two decimals", () => {
    for (const text of ["", "abc", "-5", "1.234", "1.2.3", "12k"]) {
      expect(rupeesToMinor(text)).toBeNull();
    }
  });
});

describe("moneyFromRupees", () => {
  it("builds the wire money in INR paise, or null", () => {
    expect(moneyFromRupees("25,000")).toEqual({ minor: 2_500_000, currency: "INR" });
    expect(moneyFromRupees("twenty")).toBeNull();
  });
});

describe("dates", () => {
  it("accepts a real YYYY-MM-DD calendar date only", () => {
    expect(isIsoDate("2027-01-31")).toBe(true);
    expect(isIsoDate("2027-02-30")).toBe(false);
    expect(isIsoDate("31-01-2027")).toBe(false);
  });

  it("sends a date as midnight UTC", () => {
    expect(isoDateTimeFromDate("2027-01-31")).toBe("2027-01-31T00:00:00.000Z");
  });
});

describe("field errors name their field", () => {
  it("asks for a required amount, explains an unreadable one, and accepts a good one", () => {
    expect(amountError("", "fee", true)).toBe("Enter the fee");
    expect(amountError("12k", "fee", true)).toBe("Enter the fee in rupees, such as 25000");
    expect(amountError("25,000", "fee", true)).toBeUndefined();
  });

  it("leaves an empty optional amount alone", () => {
    expect(amountError("  ", "amount", false)).toBeUndefined();
  });

  it("asks for a required date and gives the format for a wrong one", () => {
    expect(dateError("", "visit date", true)).toBe("Enter the visit date");
    expect(dateError("2027-02-30", "due date", false)).toBe("Enter the due date as YYYY-MM-DD");
    expect(dateError("", "due date", false)).toBeUndefined();
    expect(dateError(" 2027-01-20 ", "visit date", true)).toBeUndefined();
  });

  it("flags blank free text with the given message", () => {
    expect(textError("  ", "Describe the line")).toBe("Describe the line");
    expect(textError("Rooms", "Describe the line")).toBeUndefined();
  });
});

describe("errorMessage", () => {
  it("prefers the API's own message and falls back otherwise", () => {
    expect(errorMessage({ message: "Not allowed for your role" }, "Could not")).toBe(
      "Not allowed for your role",
    );
    expect(errorMessage({ message: "" }, "Could not")).toBe("Could not");
    expect(errorMessage(null, "Could not")).toBe("Could not");
  });
});

describe("choices", () => {
  it("labels every option list once per wire value", () => {
    expect(RATE_ITEM_OPTIONS).toHaveLength(9);
    expect(MILESTONE_TYPE_OPTIONS).toHaveLength(7);
    expect(FEE_STRUCTURE_OPTIONS.map((option) => option.value)).toEqual([
      "fixed",
      "percentage",
      "milestones",
    ]);
  });

  it("reads the wire values as staff words", () => {
    expect(rateItemLabel("per_plate_veg")).toBe("Per plate (veg)");
    expect(feeStructureLabel("milestones")).toBe("Milestones");
  });
});
