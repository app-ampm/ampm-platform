/**
 * Colour tokens: Peacock Night (replaces the plum palette).
 * Drop-in replacement for packages/tokens/src/colors.ts. Keeps the same semantic
 * names so every existing class (`bg-surface`, `text-primary`, `bg-brand`…) keeps working.
 *
 * Peacock Night is DARK ONLY. Four colours exist and nothing else:
 *   Midnight #0E1534 · Peacock #138A85 · Gold #DDB861 · Pearl #F1EBDD
 * Every other value below is one of those four at an opacity, pre-blended
 * onto Midnight so React Native (which cannot blend) renders the same as web.
 * `light` and `dark` are identical on purpose: the scheme toggle has no effect.
 */

export type Hex = `#${string}`;

export interface ColorToken {
  readonly light: Hex;
  readonly dark: Hex;
}

const same = (hex: Hex): ColorToken => ({ light: hex, dark: hex });

export const palette = {
  midnight: "#0E1534",
  peacock: "#138A85",
  gold: "#DDB861",
  pearl: "#F1EBDD",
} as const satisfies Record<string, Hex>;

export const colors = {
  // Surfaces. Use the glass recipe (glass.ts) for panels on web; these opaque
  // equivalents are for native where backdrop blur is unavailable or too costly.
  surface: same("#0E1534"),            // midnight, page canvas
  "surface-elevated": same("#1D2440"), // pearl 6% on midnight (glass fallback)
  "surface-inset": same("#161D3A"),    // pearl 3% on midnight (wells inside panels)

  // Text (pearl at fixed strengths)
  primary: same("#F1EBDD"),            // pearl 100%: headings, values
  muted: same("#9A9AA0"),              // pearl 58% on midnight: labels, metadata
  body: same("#C6C2BD"),               // pearl 80% on midnight: paragraphs

  // Lines and focus
  subtle: same("#2E344D"),             // pearl 16%: panel strokes, dividers
  strong: same("#5C6074"),             // pearl 40%: outline buttons, inputs
  focus: same("#DDB861"),              // gold ring + 4px gold 18% halo

  // Brand: gold is the action colour, peacock is the highlight
  brand: same("#DDB861"),              // gold: primary buttons, live, needs-you
  "brand-ink": same("#0E1534"),        // midnight on gold
  "brand-soft": same("#36373E"),       // gold 16% on midnight: soft chips
  highlight: same("#138A85"),          // peacock: active tab, verified, done
  "highlight-ink": same("#0E1534"),    // midnight on peacock
  "highlight-soft": same("#0F4157"),   // peacock 30% on midnight: peacock glass

  // Status. Peacock Night has no green/amber/red/blue: meaning comes from the
  // word in the chip (StatusChip rule) plus these four treatments.
  success: same("#138A85"),            // peacock solid: Verified, Done, Ready
  "success-soft": same("#0F4157"),
  warning: same("#DDB861"),            // gold text on gold-soft: Awaiting, Due
  "warning-soft": same("#36373E"),
  danger: same("#DDB861"),             // gold solid with midnight ink: Blocked, Needs approval
  "danger-soft": same("#36373E"),
  info: same("#F1EBDD"),               // pearl outline: Indicative, Submitted
  "info-soft": same("#1D2440"),

  overlay: same("#0E1534"),            // midnight scrim; use with /70
} as const satisfies Record<string, ColorToken>;

export type ColorName = keyof typeof colors;

export const textColors = ["primary", "muted", "body", "brand", "highlight"] as const;
export const surfaceColors = ["surface", "surface-elevated", "surface-inset"] as const;
export const statusColors = ["brand", "success", "warning", "danger", "info"] as const;
