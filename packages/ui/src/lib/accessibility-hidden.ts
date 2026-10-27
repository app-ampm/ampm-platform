import { Platform, StyleSheet, type ViewProps } from "react-native";

import { breakpoints } from "@ampm/tokens";

/** The view props that keep a surface from VoiceOver: hidden from it, or not displayed at all. */
export interface VoiceOverHiding {
  readonly accessibilityElementsHidden?: ViewProps["accessibilityElementsHidden"];
  readonly "aria-hidden"?: ViewProps["aria-hidden"];
  readonly style?: ViewProps["style"];
  readonly className?: string | undefined;
}

// NativeWind's platform variants: `web` exists only in the web build (nativewind
// dist/tailwind/web.js), the operating systems and `native` only in the native one (native.js).
const NATIVE_OSES: ReadonlySet<string> = new Set(["ios", "android", "windows", "macos"]);
const PLATFORM_VARIANTS: ReadonlySet<string> = new Set(["web", "native", ...NATIVE_OSES]);
// The tokens' preset replaces the screens, so only its breakpoints (and their max- forms) exist;
// Tailwind's other default screen names generate no class at all.
const withMax = (names: readonly string[]) => names.flatMap((name) => [name, `max-${name}`]);
const WIDTH_VARIANTS: ReadonlySet<string> = new Set(withMax(Object.keys(breakpoints)));
const MISSING_SCREENS: ReadonlySet<string> = new Set(
  withMax(["sm", "md", "lg", "xl", "2xl"].filter((name) => !WIDTH_VARIANTS.has(name))),
);
const DISPLAY_UTILITIES: ReadonlySet<string> = new Set([
  "flex",
  "block",
  "inline",
  "inline-block",
  "inline-flex",
  "grid",
  "inline-grid",
  "contents",
  "flow-root",
  "list-item",
  "table",
]);

/**
 * When a class applies here: at rest on this platform; only at some widths or under a state (dark
 * scheme, hover, focus, an unknown variant), which may or may not hold now; or never (another
 * platform, a screen the preset does not define).
 */
type Reach = "always" | "conditional" | "other";

interface ClassToken {
  readonly utility: string;
  readonly reach: Reach;
  /** Where the class's rule sits in the stylesheet: of two display rules, the higher one wins. */
  readonly rank: number;
}

// Tailwind sorts a rule by its latest-registered variant. Compiled with NATIVEWIND_OS=ios, the
// order runs: bare classes, the core state variants, the OS blocks, the native: blocks (web: sits
// at the same place in the web build), dark:, then the screens. An unknown variant ranks last, so
// a display utility under it leaves the surface announced.
const STATE_VARIANTS: ReadonlySet<string> = new Set([
  "hover",
  "focus",
  "focus-visible",
  "focus-within",
  "active",
  "enabled",
  "disabled",
]);

function variantRank(variant: string): number {
  if (STATE_VARIANTS.has(variant)) return 1;
  if (NATIVE_OSES.has(variant)) return 2;
  if (variant === "native" || variant === "web") return 3;
  if (variant === "dark") return 4;
  return WIDTH_VARIANTS.has(variant) ? 5 : 6;
}

function platformMatches(variant: string, os: string): boolean {
  return variant === os || (variant === "native" && NATIVE_OSES.has(os));
}

function reachOf(variants: readonly string[], os: string): Reach {
  let reach: Reach = "always";
  for (const variant of variants) {
    if (PLATFORM_VARIANTS.has(variant)) {
      if (!platformMatches(variant, os)) return "other";
    } else if (MISSING_SCREENS.has(variant)) {
      return "other";
    } else {
      reach = "conditional";
    }
  }
  return reach;
}

function parseClass(token: string, os: string): ClassToken {
  // Colons inside an arbitrary variant ("[&:hover]:flex") do not separate variants.
  const parts = token.split(/:(?![^[]*\])/);
  const utility = parts.pop() ?? "";
  const rank = Math.max(0, ...parts.map(variantRank));
  return { utility, reach: reachOf(parts, os), rank };
}

function isClassHidden(className: string | undefined, os: string): boolean {
  const tokens = (className ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => parseClass(token, os));
  const hiding = tokens.filter((token) => token.utility === "hidden" && token.reach === "always");
  if (hiding.length === 0) return false;
  const hiddenRank = Math.max(...hiding.map((token) => token.rank));
  // A display rule re-shows only from a later place in the stylesheet: at the same rank Tailwind
  // orders `hidden` after the display utilities, so `flex hidden` and `ios:hidden ios:flex` hide.
  const shows = tokens.some(
    (token) =>
      DISPLAY_UTILITIES.has(token.utility) && token.reach !== "other" && token.rank > hiddenRank,
  );
  return !shows;
}

/**
 * True when the view's own props keep it and its content from VoiceOver, so a surface that
 * announces itself on iOS stays silent instead of speaking text the user cannot reach: hidden from
 * the accessibility tree (`accessibilityElementsHidden`, `aria-hidden`) or not displayed (a
 * display-none style, or a `hidden` class that applies on this platform at rest). NativeWind's
 * variants are resolved against `Platform.OS`: `native:hidden` and `ios:hidden` hide on iOS,
 * `hidden web:flex` stays hidden there and shows on the web, and of two display classes the one
 * later in NativeWind's stylesheet wins (`native:hidden ios:flex` hides on iOS).
 * `importantForAccessibility` is Android-only and does not count. A hidden ancestor, or a
 * breakpoint or state variant that hides or shows (`md:hidden`, `hidden md:flex`,
 * `hidden dark:flex`), is not decided here: such a surface counts as reachable and announces, so
 * render it conditionally instead.
 *
 *   useAnnounce(text, isLive && !isHiddenFromVoiceOver({ ...viewProps, className }));
 *   isHiddenFromVoiceOver({ className: "hidden web:flex" }); // true on iOS, false on the web
 */
export function isHiddenFromVoiceOver(props: VoiceOverHiding): boolean {
  return (
    props.accessibilityElementsHidden === true ||
    props["aria-hidden"] === true ||
    StyleSheet.flatten(props.style)?.display === "none" ||
    isClassHidden(props.className, Platform.OS)
  );
}
