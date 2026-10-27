import { isHiddenFromVoiceOver } from "./accessibility-hidden";

describe("isHiddenFromVoiceOver", () => {
  it.each([
    { accessibilityElementsHidden: true },
    { "aria-hidden": true },
    { style: { display: "none" as const } },
    { style: [{ padding: 4 }, { display: "none" as const }] },
    { className: "hidden" },
    { className: "p-2 hidden" },
  ])("is true for %o", (props) => {
    expect(isHiddenFromVoiceOver(props)).toBe(true);
  });

  it.each([
    {},
    { accessibilityElementsHidden: false },
    { "aria-hidden": false },
    // Android-only (React Native ViewAccessibility): VoiceOver still reaches the content.
    { importantForAccessibility: "no-hide-descendants" as const },
    { style: { display: "flex" as const } },
    // Shown from a breakpoint on: whether it is hidden now depends on the screen width.
    { className: "hidden md:flex" },
    { className: "overflow-hidden" },
  ])("is false for %o", (props) => {
    expect(isHiddenFromVoiceOver(props)).toBe(false);
  });
});
