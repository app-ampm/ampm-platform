import { isHiddenFromAccessibility } from "./accessibility-hidden";

describe("isHiddenFromAccessibility", () => {
  it.each([
    { accessibilityElementsHidden: true },
    { importantForAccessibility: "no-hide-descendants" as const },
    { "aria-hidden": true },
  ])("is true for %o", (props) => {
    expect(isHiddenFromAccessibility(props)).toBe(true);
  });

  it.each([
    {},
    { accessibilityElementsHidden: false },
    // "no" hides the view itself but leaves its content reachable.
    { importantForAccessibility: "no" as const },
    { importantForAccessibility: "auto" as const },
    { "aria-hidden": false },
  ])("is false for %o", (props) => {
    expect(isHiddenFromAccessibility(props)).toBe(false);
  });
});
