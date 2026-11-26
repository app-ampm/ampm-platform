import { describe, expect, it } from "vitest";

import { markupOf, noop, tagsWith } from "./markup.test-utils";
import { NumberUnitField, unitSelectId } from "./number-unit-field";

/* A number with its unit (D-190 §5): an area in sq ft or m², as the hotel gives it. */

const UNITS = [
  { value: "sqft", label: "sq ft" },
  { value: "sqm", label: "m²" },
];

const field = (props: Partial<Parameters<typeof NumberUnitField>[0]> = {}) =>
  markupOf(
    <NumberUnitField
      id="size"
      label="Size"
      value="450"
      onChange={noop}
      unit="sqft"
      units={UNITS}
      onUnitChange={noop}
      unitLabel="Unit of the size"
      {...props}
    />,
  );

describe("number with its unit", () => {
  it("labels the number by its id and gives the unit list a name of its own", () => {
    const html = field();
    expect(html).toMatch(/<label for="size"[^>]*>Size<\/label>/);
    const [input] = tagsWith(html, "input", 'id="size"');
    expect(input).toContain('value="450"');
    expect(input).toContain('inputMode="numeric"');
    const [select] = tagsWith(html, "select", `id="${unitSelectId("size")}"`);
    expect(select).toContain('aria-label="Unit of the size"');
  });

  it("offers each unit and selects the one given", () => {
    const html = field({ unit: "sqm" });
    expect(tagsWith(html, "option", 'value="sqm"')[0]).toContain('selected=""');
    expect(tagsWith(html, "option", 'value="sqft"')[0]).not.toContain('selected=""');
    expect(html).toContain(">m²</option>");
  });

  it("points both the number and its unit at the error, and marks the number invalid", () => {
    const html = field({ error: "Give the area as a whole number", required: true });
    const [input] = tagsWith(html, "input", 'id="size"');
    expect(input).toContain('aria-invalid="true"');
    expect(input).toContain('aria-describedby="size-error"');
    expect(input).toContain('aria-required="true"');
    expect(tagsWith(html, "select", 'id="size-unit"')[0]).toContain(
      'aria-describedby="size-error"',
    );
    expect(html).toContain('<p id="size-error" role="alert"');
    expect(html).toContain("border-brand");
  });

  it("describes both with the help line while there is no error", () => {
    const html = field({ help: "As on your fact sheet", inputMode: "decimal" });
    expect(tagsWith(html, "input", 'id="size"')[0]).toContain('aria-describedby="size-help"');
    expect(tagsWith(html, "input", 'id="size"')[0]).toContain('inputMode="decimal"');
    expect(tagsWith(html, "select", 'id="size-unit"')[0]).toContain('aria-describedby="size-help"');
  });
});
