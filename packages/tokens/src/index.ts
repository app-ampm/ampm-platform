/**
 * @ampm/tokens: the only place theme values exist. Plain data, no framework.
 * `pnpm tokens:build` (scripts/build.ts) turns these files into dist/tailwind.preset.cjs
 * (the Tailwind preset both apps use) and dist/tokens.css (the CSS variables).
 */
export const TOKENS_VERSION = "0.1.0";

export { colors, textColors, surfaceColors, statusColors } from "./colors";
export type { Hex, ColorToken, ColorName } from "./colors";
export { spacing, sizes } from "./spacing";
export { radii } from "./radii";
export { fontFamily, fontSize, fontWeight } from "./typography";
export { shadows } from "./shadows";
export { duration, easing, motionMs, motionBezier } from "./motion";
export { breakpoints } from "./breakpoints";
export type { Breakpoint } from "./breakpoints";
export { layers } from "./layers";
