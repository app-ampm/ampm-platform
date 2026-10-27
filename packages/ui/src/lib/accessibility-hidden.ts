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
// The tokens' preset replaces the screens, so only its breakpoints (and their max- forms) exist.
const WIDTH_VARIANTS: ReadonlySet<string> = new Set(
  Object.keys(breakpoints).flatMap((name) => [name, `max-${name}`]),
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
 * When a class applies here: at rest on this platform, at some widths only, or under a state
 * (dark scheme, hover, focus, an unknown variant) or on another platform, where it does not count.
 */
type Reach = "always" | "width" | "other";

interface ClassToken {
  readonly utility: string;
  readonly variants: readonly string[];
  readonly reach: Reach;
}

function platformMatches(variant: string, os: string): boolean {
  return variant === os || (variant === "native" && NATIVE_OSES.has(os));
}

function reachOf(variants: readonly string[], os: string): Reach {
  let reach: Reach = "always";
  for (const variant of variants) {
    if (PLATFORM_VARIANTS.has(variant)) {
      if (!platformMatches(variant, os)) return "other";
    } else if (WIDTH_VARIANTS.has(variant)) {
      reach = "width";
    } else {
      return "other";
    }
  }
  return reach;
}

function parseClass(token: string, os: string): ClassToken {
  // Colons inside an arbitrary variant ("[&:hover]:flex") do not separate variants.
  const parts = token.split(/:(?![^[]*\])/);
  const utility = parts.pop() ?? "";
  return { utility, variants: parts, reach: reachOf(parts, os) };
}

function isClassHidden(className: string | undefined, os: string): boolean {
  const tokens = (className ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => parseClass(token, os));
  const hides = tokens.some((token) => token.utility === "hidden" && token.reach === "always");
  // A platform or breakpoint variant comes after the bare class in the stylesheet, so its display
  // wins over `hidden`; a bare `flex` does not (Tailwind orders `hidden` after it).
  const shows = tokens.some(
    (token) =>
      DISPLAY_UTILITIES.has(token.utility) && token.variants.length > 0 && token.reach !== "other",
  );
  return hides && !shows;
}

/**
 * True when the view's own props keep it and its content from VoiceOver, so a surface that
 * announces itself on iOS stays silent instead of speaking text the user cannot reach: hidden from
 * the accessibility tree (`accessibilityElementsHidden`, `aria-hidden`) or not displayed (a
 * display-none style, or a `hidden` class that applies on this platform at rest). NativeWind's
 * variants are resolved against `Platform.OS`: `native:hidden` and `ios:hidden` hide on iOS,
 * `hidden web:flex` stays hidden there and shows on the web. State variants (`dark:`, `hover:`)
 * neither hide nor show. `importantForAccessibility` is Android-only and does not count. A hidden
 * ancestor, or a breakpoint that hides or shows (`md:hidden`, `hidden md:flex`), is not decided
 * here; render the surface conditionally instead.
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
