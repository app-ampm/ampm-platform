import { describe, expect, it } from "vitest";

import { maskPhone } from "./phone-mask";

/* A mobile shown back to its person (client activation, D-147; the hotel form's code page, D-189 §4). */
describe("maskPhone", () => {
  it("shows an Indian mobile's last four digits only", () => {
    expect(maskPhone("+917000001234")).toBe("+91 ••••• •1234");
  });

  it("keeps the country code and the last four digits of any other number", () => {
    expect(maskPhone("+447700900123")).toBe("+44 ••••••0123");
  });

  it("never shows more than the last four digits of a short number", () => {
    expect(maskPhone("+1234567")).toBe("+12 •4567");
  });
});
