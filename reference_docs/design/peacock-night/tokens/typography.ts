/**
 * Type tokens: Peacock Night. Drop-in replacement for packages/tokens/src/typography.ts.
 * Gilda Display for display, Manrope for the interface and all data (tabular
 * numerals replace the old monospace), Rozha One for Devanagari greetings only.
 * Gilda Display ships one weight (400); never synthesise bold (font-synthesis: none).
 */
const sansFallback = ["system-ui", "-apple-system", "Segoe UI", "sans-serif"];
const displayFallback = ["Georgia", "serif"];

export const fontFaces = {
  display: "GildaDisplay-Regular",
  sans: "Manrope-Regular",
  sansMedium: "Manrope-Medium",
  sansSemibold: "Manrope-SemiBold",
  sansBold: "Manrope-Bold",
  devanagari: "RozhaOne-Regular",
} as const;

export const fontFamily = {
  display: [fontFaces.display, "Gilda Display", ...displayFallback],
  sans: [fontFaces.sans, "Manrope", ...sansFallback],
  "sans-medium": [fontFaces.sansMedium, "Manrope", ...sansFallback],
  "sans-semibold": [fontFaces.sansSemibold, "Manrope", ...sansFallback],
  "sans-bold": [fontFaces.sansBold, "Manrope", ...sansFallback],
  devanagari: [fontFaces.devanagari, "Rozha One", ...displayFallback],
  // `font-mono` is retired: use `font-sans tabular-nums` for prices, dates, counts.
  mono: [fontFaces.sansSemibold, "Manrope", ...sansFallback],
} as const;

/** Interface sizes (rem). Kept from the original scale plus display steps. */
export const fontSize = {
  "2xs": ["0.625rem", { lineHeight: "0.875rem" }], // 10 · micro labels (uppercase, 0.16–0.22em)
  xs: ["0.6875rem", { lineHeight: "1rem" }],       // 11 · section labels
  sm: ["0.8125rem", { lineHeight: "1.25rem" }],    // 13 · secondary text, buttons (small)
  base: ["0.9375rem", { lineHeight: "1.5rem" }],   // 15 · body
  lg: ["1rem", { lineHeight: "1.5rem" }],          // 16 · interface labels
  xl: ["1.125rem", { lineHeight: "1.75rem" }],     // 18 · lead paragraph
  "2xl": ["1.5rem", { lineHeight: "1.75rem" }],    // 24 · display: card titles
  "3xl": ["1.75rem", { lineHeight: "2rem" }],      // 28 · display: subheading
  "4xl": ["2.25rem", { lineHeight: "2.5rem" }],    // 36 · display: screen title (mobile)
  "5xl": ["2.75rem", { lineHeight: "1" }],         // 44 · display: section heading
  "6xl": ["4rem", { lineHeight: "1" }],            // 64 · display: page title
  "7xl": ["5.5rem", { lineHeight: "0.95" }],       // 88 · display: hero
} as const;

export const fontWeight = { normal: "400", medium: "500", semibold: "600", bold: "700" } as const;

/** Letter spacing used by uppercase labels. */
export const letterSpacing = { label: "0.16em", eyebrow: "0.22em", wordmark: "0.1em" } as const;
