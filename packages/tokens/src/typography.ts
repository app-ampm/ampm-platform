/**
 * Type tokens. Fonts are the design package's: Fraunces for display, Source Sans 3 for text,
 * JetBrains Mono for code. They are loaded with expo-font on native and next/font on web
 * (styling.md); React Native uses only the first family of each list, the rest are web fallbacks.
 * Sizes keep Tailwind's t-shirt names so `text-lg` reads the same everywhere and tailwind-merge
 * can tell a size from a colour.
 */
export const fontFamily = {
  display: ["Fraunces", "Georgia", "serif"],
  sans: ["Source Sans 3", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
  mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
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
