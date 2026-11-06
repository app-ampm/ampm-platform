/**
 * Type tokens: Peacock Night. Gilda Display for display type, Manrope for the interface and all data
 * (tabular numerals replace the retired monospace), Rozha One for Devanagari greetings only
 * ("शुभ विवाह"), never interface text.
 *
 * React Native cannot pick a weight inside a custom family, so each weight that is used is its own
 * family, named after the face (`Manrope-SemiBold`); the Expo app loads the faces under exactly these
 * names with expo-font (`fontFaces`), so `font-sans-semibold` means the same on iOS, Android and the
 * Expo web export. The Next.js site loads the same families with next/font and reaches them through
 * the CSS variables in `webFontVariables` (the web preset maps every family to its variable).
 *
 * Gilda Display ships one weight (400): never synthesise a bold (`font-synthesis: none` on the web, and
 * the Text component ignores `weight` on display variants). Sizes keep Tailwind's t-shirt names so
 * `text-lg` reads the same everywhere and tailwind-merge can tell a size from a colour.
 */
const sansFallback = ["system-ui", "-apple-system", "Segoe UI", "sans-serif"];
const displayFallback = ["Georgia", "serif"];

/** The face names the Expo app registers; the first entry of each family below. */
export const fontFaces = {
  display: "GildaDisplay-Regular",
  sans: "Manrope-Regular",
  sansMedium: "Manrope-Medium",
  sansSemibold: "Manrope-SemiBold",
  sansBold: "Manrope-Bold",
  sansExtrabold: "Manrope-ExtraBold",
  devanagari: "RozhaOne-Regular",
} as const;

export const fontFamily = {
  display: [fontFaces.display, "Gilda Display", ...displayFallback],
  sans: [fontFaces.sans, "Manrope", ...sansFallback],
  "sans-medium": [fontFaces.sansMedium, "Manrope", ...sansFallback],
  "sans-semibold": [fontFaces.sansSemibold, "Manrope", ...sansFallback],
  "sans-bold": [fontFaces.sansBold, "Manrope", ...sansFallback],
  "sans-extrabold": [fontFaces.sansExtrabold, "Manrope", ...sansFallback],
  devanagari: [fontFaces.devanagari, "Rozha One", ...displayFallback],
  // Retired: data is `font-sans-semibold tabular-nums` (the Text `data` variant). Kept as an alias so
  // an old `font-mono` still renders Manrope instead of falling back to the platform monospace.
  mono: [fontFaces.sansSemibold, "Manrope", ...sansFallback],
} as const;

/**
 * The CSS variables the Next.js site's next/font loaders declare (apps/web/src/app/fonts.ts), one per
 * typeface; the web preset points every family at its variable. next/font needs literal option values,
 * so the site spells these names out and a test checks they match.
 */
export const webFontVariables = {
  display: "--font-display",
  sans: "--font-sans",
  devanagari: "--font-devanagari",
} as const;

/** Which typeface each family uses on the web (the weight comes from the `font-*` weight class). */
export const webFontFamilyTypeface = {
  display: "display",
  sans: "sans",
  "sans-medium": "sans",
  "sans-semibold": "sans",
  "sans-bold": "sans",
  "sans-extrabold": "sans",
  devanagari: "devanagari",
  mono: "sans",
} as const satisfies Record<keyof typeof fontFamily, keyof typeof webFontVariables>;

/**
 * `text-*`: font size with its line height, both in rem. The display steps are Gilda Display sizes:
 * card titles 24–28, screen titles 36, section headings 44, page titles 64, heroes 88.
 */
export const fontSize = {
  "2xs": ["0.625rem", { lineHeight: "0.875rem" }], // 10 · eyebrow labels (uppercase, tracked)
  xs: ["0.6875rem", { lineHeight: "1rem" }], // 11 · captions, chips, data
  sm: ["0.8125rem", { lineHeight: "1.25rem" }], // 13 · secondary text, labels, small buttons
  base: ["0.9375rem", { lineHeight: "1.5rem" }], // 15 · body (1.6)
  lg: ["1rem", { lineHeight: "1.5rem" }], // 16 · interface labels, buttons
  xl: ["1.125rem", { lineHeight: "1.75rem" }], // 18 · lead paragraph
  "2xl": ["1.5rem", { lineHeight: "1.625rem" }], // 24 · display: card title
  "3xl": ["1.75rem", { lineHeight: "1.875rem" }], // 28 · display: subheading
  "4xl": ["2.25rem", { lineHeight: "2.5rem" }], // 36 · display: screen title (phone)
  "5xl": ["2.75rem", { lineHeight: "2.75rem" }], // 44 · display: section heading
  "6xl": ["4rem", { lineHeight: "4rem" }], // 64 · display: page title, big numbers
  "7xl": ["5.5rem", { lineHeight: "5.25rem" }], // 88 · display: hero (0.95)
} as const;

export const fontWeight = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
} as const;

/** `tracking-*` for uppercase labels and the wordmark (Tailwind's own steps stay available). */
export const letterSpacing = {
  label: "0.16em",
  eyebrow: "0.22em",
  wordmark: "0.1em",
} as const;
