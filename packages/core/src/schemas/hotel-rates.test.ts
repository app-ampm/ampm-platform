import { describe, expect, it } from "vitest";

import {
  rateCardCreateRequest,
  rateCardUpdateRequest,
  rateItemCreateRequest,
  verificationCreateRequest,
} from "./hotel-rates.js";

const inr = (minor: number) => ({ minor, currency: "INR" as const });

describe("rateCardCreateRequest", () => {
  it("requires a name and defaults the currency to INR; uppercases a given one", () => {
    expect(rateCardCreateRequest.parse({ name: "Wedding season 2027" }).currency).toBe("INR");
    expect(rateCardCreateRequest.parse({ name: "X", currency: "inr" }).currency).toBe("INR");
    expect(rateCardCreateRequest.safeParse({ currency: "INR" }).success).toBe(false);
  });

  it("validates a date as YYYY-MM-DD", () => {
    expect(rateCardCreateRequest.safeParse({ name: "X", validFrom: "01-01-2027" }).success).toBe(
      false,
    );
    expect(rateCardCreateRequest.safeParse({ name: "X", validFrom: "2027-01-01" }).success).toBe(
      true,
    );
  });
});

describe("rateCardUpdateRequest", () => {
  it("rejects an empty patch and accepts a single field (no default leaks)", () => {
    expect(rateCardUpdateRequest.safeParse({}).success).toBe(false);
    expect(rateCardUpdateRequest.safeParse({ name: "Renamed" }).success).toBe(true);
  });
});

describe("rateItemCreateRequest", () => {
  const base = {
    itemType: "per_plate_veg" as const,
    unit: "per_plate" as const,
    amount: inr(180000),
  };

  it("defaults isIndicative true and clientVisible false", () => {
    const item = rateItemCreateRequest.parse(base);
    expect(item.isIndicative).toBe(true);
    expect(item.clientVisible).toBe(false);
  });

  it("accepts a range and rejects amountMax below amount", () => {
    expect(rateItemCreateRequest.safeParse({ ...base, amountMax: inr(250000) }).success).toBe(true);
    expect(rateItemCreateRequest.safeParse({ ...base, amountMax: inr(100000) }).success).toBe(
      false,
    );
  });

  it("rejects an unknown item type or unit", () => {
    expect(rateItemCreateRequest.safeParse({ ...base, itemType: "buffet" }).success).toBe(false);
    expect(rateItemCreateRequest.safeParse({ ...base, unit: "per_hour" }).success).toBe(false);
  });
});

describe("verificationCreateRequest", () => {
  it("requires a field group and a source", () => {
    expect(verificationCreateRequest.safeParse({ fieldGroup: "rates" }).success).toBe(false);
    expect(
      verificationCreateRequest.safeParse({ fieldGroup: "rates", source: "email" }).success,
    ).toBe(true);
  });
});
