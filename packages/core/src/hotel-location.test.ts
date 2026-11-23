import { describe, expect, it } from "vitest";

import {
  INDIA_POSTAL_CODE,
  isGoogleMapsUrl,
  normalisePostalCode,
  postalCodeProblem,
} from "./hotel-location";

describe("isGoogleMapsUrl", () => {
  it.each([
    "https://www.google.com/maps/place/Synthetic+Lake+Hotel/@24.57,73.68,17z",
    "https://google.com/maps?q=24.57,73.68",
    "https://www.google.co.in/maps/@24.57,73.68,15z",
    "https://maps.google.com/?q=24.57,73.68",
    "https://maps.google.co.in/maps?q=24.57,73.68",
    "https://maps.app.goo.gl/AbC123xyz",
    "https://maps.app.goo.gl/AbC123xyz?g_st=iw",
    "https://goo.gl/maps/AbC123xyz",
  ])("accepts %s", (link) => {
    expect(isGoogleMapsUrl(link)).toBe(true);
  });

  it.each([
    ["plain http", "http://www.google.com/maps/place/x"],
    ["another host", "https://maps.example.com/place/x"],
    ["a look-alike host", "https://www.google.com.example.com/maps"],
    ["an open redirect path", "https://www.google.com/url?q=https://example.com"],
    ["a dot segment out of /maps", "https://www.google.com/maps/../url?q=https://example.com"],
    ["an encoded dot segment", "https://www.google.com/maps/%2E%2e/url?q=https://example.com"],
    [
      "a backslash a browser reads as /",
      "https://www.google.com/maps/..\\url?q=https://example.com",
    ],
    ["the redirector on maps.google", "https://maps.google.com/url?q=https://example.com"],
    ["another maps.google path", "https://maps.google.co.in/search?q=hotel"],
    ["a non-maps google path", "https://www.google.com/search?q=hotel"],
    ["user info", "https://user@maps.google.com/"],
    ["a port", "https://maps.google.com:8443/"],
    ["whitespace inside", "https://maps.google.com/ place"],
    ["a goo.gl link outside maps", "https://goo.gl/AbC123"],
    ["javascript", "javascript:alert(1)"],
  ])("refuses %s", (_label, link) => {
    expect(isGoogleMapsUrl(link)).toBe(false);
  });

  it("refuses a link over 2,048 characters", () => {
    expect(isGoogleMapsUrl(`https://maps.google.com/?q=${"a".repeat(2048)}`)).toBe(false);
  });
});

describe("postal codes", () => {
  it("removes spaces", () => {
    expect(normalisePostalCode(" 313 001 ")).toBe("313001");
  });

  it("checks India's six-digit PIN, first digit 1 to 9", () => {
    expect(INDIA_POSTAL_CODE.test("313001")).toBe(true);
    expect(postalCodeProblem("India", "313 001")).toBeNull();
    expect(postalCodeProblem("india", "013001")).not.toBeNull();
    expect(postalCodeProblem("India", "31300")).not.toBeNull();
    expect(postalCodeProblem("India", "31300A")).not.toBeNull();
  });

  it("accepts any code for another or unknown country", () => {
    expect(postalCodeProblem("Nepal", "44600")).toBeNull();
    expect(postalCodeProblem(null, "ABC 123")).toBeNull();
  });
});
