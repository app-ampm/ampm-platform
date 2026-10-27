import { Platform } from "react-native";

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

type Os = "ios" | "android" | "web";
type Verdicts = Readonly<Record<Os, boolean>>;

const everywhere: Verdicts = { ios: true, android: true, web: true };
const nowhere: Verdicts = { ios: false, android: false, web: false };

// NativeWind 4.2.7 adds `web:` only to the web build (dist/tailwind/web.js:31) and `ios:`,
// `android:`, `windows:`, `macos:` and `native:` only to the native one (native.js:29-32);
// styling.md has platform differences written with exactly these variants. The tokens' preset
// sets the screens to md, lg and xl, so `sm:` and `2xl:` generate no class at all.
const cases: readonly (readonly [string, Verdicts])[] = [
  ["hidden web:flex", { ios: true, android: true, web: false }],
  ["native:hidden", { ios: true, android: true, web: false }],
  ["ios:hidden", { ios: true, android: false, web: false }],
  ["android:hidden", { ios: false, android: true, web: false }],
  ["web:hidden", { ios: false, android: false, web: true }],
  ["hidden android:flex", { ios: true, android: false, web: true }],
  ["hidden ios:flex", { ios: false, android: true, web: true }],
  ["hidden native:flex", { ios: false, android: false, web: true }],
  ["hidden web:md:flex", { ios: true, android: true, web: false }],
  ["native:hidden web:flex", { ios: true, android: true, web: false }],
  // The later rule wins. Compiled with NATIVEWIND_OS=ios, the stylesheet runs: bare classes,
  // state variants (hover:), the OS blocks (android:, ios:), the native: blocks, dark:, then the
  // screens; within one variant `hidden` comes after the display utilities.
  ["native:hidden ios:flex", { ios: true, android: true, web: false }],
  ["native:hidden android:flex", { ios: true, android: true, web: false }],
  ["ios:hidden ios:flex", { ios: true, android: false, web: false }],
  ["native:hidden native:flex", { ios: true, android: true, web: false }],
  ["web:hidden web:flex", { ios: false, android: false, web: true }],
  ["flex hidden", everywhere],
  ["ios:hidden native:flex", nowhere],
  ["native:hidden hover:flex", { ios: true, android: true, web: false }],
  ["native:hidden dark:flex", nowhere],
  ["native:hidden md:flex", nowhere],
  // The important modifier compiles to `display: none !important` (`.\!hidden`), which beats any
  // display rule without it, and loses to a later important one.
  ["!hidden", everywhere],
  ["!hidden md:flex", everywhere],
  ["!hidden native:flex", everywhere],
  ["native:!hidden web:flex", { ios: true, android: true, web: false }],
  ["hidden !flex", nowhere],
  ["native:hidden !flex", nowhere],
  ["!hidden md:!flex", nowhere],
  ["!flex !hidden", everywhere],
  ["!hidden ios:!flex", { ios: false, android: true, web: true }],
  // A state variant can display the view: the tokens' preset sets darkMode "class", so
  // `.dark\:flex:is(.dark *)` shows it in dark mode, and ui.md:13 wants errors announced. Like a
  // breakpoint, the helper leaves it announced rather than silence a displayed surface.
  ["hidden dark:flex", nowhere],
  ["hidden hover:flex", nowhere],
  ["hidden focus:flex", nowhere],
  ["hidden aria-selected:flex", nowhere],
  ["hidden [&:hover]:flex", nowhere],
  // Not breakpoints in this project: the class does nothing.
  ["hidden sm:flex", everywhere],
  ["hidden 2xl:flex", everywhere],
  // A real breakpoint leaves the visibility to the width, either way round.
  ["hidden md:flex", nowhere],
  ["hidden lg:block", nowhere],
  ["hidden xl:flex", nowhere],
  ["hidden max-md:flex", nowhere],
  ["md:hidden", nowhere],
  ["dark:hidden", nowhere],
  ["native:overflow-hidden", nowhere],
];

describe.each<Os>(["ios", "android", "web"])("isHiddenFromVoiceOver on %s", (os) => {
  beforeEach(() => {
    jest.replaceProperty(Platform, "OS", os);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(cases)("resolves %s against the platform's variants", (className, verdicts) => {
    expect(isHiddenFromVoiceOver({ className })).toBe(verdicts[os]);
  });
});
