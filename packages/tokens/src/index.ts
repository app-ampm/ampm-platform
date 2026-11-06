/**
 * @ampm/tokens: the only place theme values exist. Plain data, no framework. The values are the
 * Peacock Night design system (docs/design/peacock-night.md).
 * `pnpm tokens:build` (scripts/build.ts) turns these files into dist/tailwind.preset.cjs (the preset
 * the Expo app uses with NativeWind), dist/tailwind.preset.web.cjs (the Next.js site's preset) and
 * dist/tokens.css (the CSS variables).
 */
export const TOKENS_VERSION = "1.0.0";

export {
  colors,
  contrastPairs,
  textColors,
  surfaceColors,
  statusColors,
  MIN_TEXT_CONTRAST,
} from "./colors";
export type { Hex, ColorToken, ColorName, ContrastPair } from "./colors";
export { spacing, spacingPx, sizes } from "./spacing";
export { radii } from "./radii";
export {
  fontFaces,
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
  webFontVariables,
} from "./typography";
export { shadows } from "./shadows";
export { glass, glow, backdropBlur, backdropSaturate, backgroundImage, nativeBlur } from "./glass";
export type { GlassRecipe, GlowTone } from "./glass";
export { opacity } from "./opacity";
export { duration, easing, motionMs, motionBezier } from "./motion";
export { breakpoints } from "./breakpoints";
export type { Breakpoint } from "./breakpoints";
export { layers } from "./layers";
