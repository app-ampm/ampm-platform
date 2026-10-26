/**
 * Type tokens. Fonts are the design package's: Fraunces for display, Source Sans 3 for text,
 * JetBrains Mono for code. React Native cannot pick a weight inside a custom family, so each weight
 * that is used is its own family, named after the face (`SourceSans3-SemiBold`); the apps load the
 * faces under exactly these names with expo-font (`fontFaces`), and web gets them through @font-face
 * under the same names, so `font-sans-semibold` means the same everywhere. The Text component maps a
 * weight to these families. Sizes keep Tailwind's t-shirt names so `text-lg` reads the same
 * everywhere and tailwind-merge can tell a size from a colour.
 */
const sansFallback = ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"];
const displayFallback = ["Georgia", "serif"];
const monoFallback = ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"];

/** The face names the apps register; the first entry of each family below. */
export const fontFaces = {
  display: "Fraunces",
  displaySemibold: "Fraunces-SemiBold",
  sans: "Source Sans 3",
  sansMedium: "SourceSans3-Medium",
  sansSemibold: "SourceSans3-SemiBold",
  sansBold: "SourceSans3-Bold",
  mono: "JetBrains Mono",
} as const;

export const fontFamily = {
  display: [fontFaces.display, ...displayFallback],
  "display-semibold": [fontFaces.displaySemibold, ...displayFallback],
  sans: [fontFaces.sans, ...sansFallback],
  "sans-medium": [fontFaces.sansMedium, ...sansFallback],
  "sans-semibold": [fontFaces.sansSemibold, ...sansFallback],
  "sans-bold": [fontFaces.sansBold, ...sansFallback],
  mono: [fontFaces.mono, ...monoFallback],
} as const;

/** `text-*`: font size with its line height, both in rem. */
export const fontSize = {
  xs: ["0.75rem", { lineHeight: "1rem" }],
  sm: ["0.875rem", { lineHeight: "1.25rem" }],
  base: ["1rem", { lineHeight: "1.5rem" }],
  lg: ["1.125rem", { lineHeight: "1.75rem" }],
  xl: ["1.25rem", { lineHeight: "1.75rem" }],
  "2xl": ["1.5rem", { lineHeight: "2rem" }],
  "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
  "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
} as const;

export const fontWeight = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;
