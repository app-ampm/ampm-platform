import { describe, expect, it } from "vitest";

import { clientAmount, formatAmount, internalAmount } from "./money";

describe("money", () => {
  it("formats whole rupees with Indian grouping", () => {
    expect(formatAmount(clientAmount(123456700))).toBe("₹12,34,567");
  });

  it("shows paise only when present", () => {
    expect(formatAmount(clientAmount(123450))).toBe("₹1,234.50");
  });

  it("refuses fractional minor units", () => {
    expect(() => clientAmount(10.5)).toThrow(RangeError);
  });

  it("keeps the audience in the type", () => {
    const internal = internalAmount(1000);
    // @ts-expect-error an internal amount is not a client amount
    const leaked: ReturnType<typeof clientAmount> = internal;
    expect(leaked.minor).toBe(1000);
  });
});
