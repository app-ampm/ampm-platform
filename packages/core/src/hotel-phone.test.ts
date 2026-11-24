import { describe, expect, it } from "vitest";

import { HOTEL_PHONE_REFUSAL, normaliseHotelPhone } from "./hotel-phone";

describe("normaliseHotelPhone", () => {
  it.each([
    ["a mobile, ten digits", "98765 43210", "+919876543210"],
    ["a mobile with its trunk 0", "098765-43210", "+919876543210"],
    ["a mobile with +91", "+91 98765 43210", "+919876543210"],
    ["a mobile with 91 and no plus", "91 98765 43210", "+919876543210"],
    ["a landline with its area code", "0141 234 5678", "+911412345678"],
    ["a landline in brackets and hyphens", "(0141) 234-5678", "+911412345678"],
    ["a landline with dots", "0141.234.5678", "+911412345678"],
    ["a landline with +91", "+91-141-2345678", "+911412345678"],
    ["the trunk 0 written after +91", "+91 (0)141 234 5678", "+911412345678"],
    ["00 for the international prefix", "0091 141 234 5678", "+911412345678"],
    ["00 with the trunk 0", "0091 (0) 141 234 5678", "+911412345678"],
    ["a toll-free 1800 number, 11 digits", "1800 123 4567", "+9118001234567"],
    ["a toll-free 1800 number, 10 digits", "1800-12-3456", "+911800123456"],
    ["a toll-free number with its trunk 0", "0 1800 123 4567", "+9118001234567"],
    ["a non-Indian number", "+44 20 7946 0958", "+442079460958"],
    ["00 before a non-Indian number", "001 415 555 0134", "+14155550134"],
    ["typographic hyphens from a PDF", "0141–234‑5678", "+911412345678"],
    ["a typographic hyphen and an em dash", "0141‐234—5678", "+911412345678"],
    ["a minus sign", "98765−43210", "+919876543210"],
    ["a non-breaking space", "+91 98765 43210", "+919876543210"],
  ])("reads %s", (_case, input, expected) => {
    expect(normaliseHotelPhone(input)).toBe(expected);
  });

  it.each([
    ["an extension written ext", "+91 141 234 5678 ext 12"],
    ["an extension written x", "0141 234 5678 x 123"],
    ["two numbers", "0141 234 5678 / 79"],
    ["two numbers separated by a comma", "98765 43210, 98765 43211"],
    ["letters", "call the front desk"],
    ["too few digits", "12345"],
    ["too few digits after +", "+91 1234"],
    ["too many digits after +", "+91 1234 5678 9012 3456"],
    ["a country code of 0", "+0 141 234 5678"],
    ["eleven digits that are not toll-free", "91141234567"],
    ["a plus in the middle", "0141+2345678"],
    ["nothing", "   "],
  ])("refuses %s", (_case, input) => {
    expect(normaliseHotelPhone(input)).toBeNull();
  });

  it("refuses with one message that says where an extension goes", () => {
    expect(HOTEL_PHONE_REFUSAL).toBe(
      "Enter a full phone number such as +91 141 234 5678. Put an extension in the role title.",
    );
  });
});
