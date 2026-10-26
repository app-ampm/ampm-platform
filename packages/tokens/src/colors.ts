/**
 * Colour tokens. Semantic names only: the class is `bg-surface`, `text-primary`, `border-subtle`,
 * `bg-brand`, `text-danger` (.claude/rules/styling.md); palette names never leave this package.
 *
 * Values: the AMPM design package's palette (docs/tools/site_build.mjs, plum accent on warm greys),
 * extended with four status hues. Every text colour reaches WCAG AA (4.5:1) on every surface of
 * its scheme and every status colour on its own `-soft` background; `tokens:build` checks this and
 * fails otherwise, so a value can only change here if it still passes.
 */

export type Hex = `#${string}`;

export interface ColorToken {
  readonly light: Hex;
  readonly dark: Hex;
}

export const colors = {
  // Surfaces, from page canvas to raised to sunken
  surface: { light: "#f8f6fa", dark: "#171319" },
  "surface-elevated": { light: "#ffffff", dark: "#211c25" },
  "surface-inset": { light: "#f1edf4", dark: "#27212c" },

  // Text
  primary: { light: "#221c2a", dark: "#ece7f0" },
  muted: { light: "#6d6476", dark: "#a89fb2" },

  // Lines and focus
  subtle: { light: "#e4dfe9", dark: "#342d3a" },
  strong: { light: "#c9c0d1", dark: "#4a4152" },
  focus: { light: "#7a1f4f", dark: "#e694c3" },

  // Brand (AMPM plum) and the text that sits on it
  brand: { light: "#7a1f4f", dark: "#e694c3" },
  "brand-ink": { light: "#ffffff", dark: "#1d0a14" },
  "brand-soft": { light: "#f6e4ee", dark: "#3a1f2f" },

  // Status: the hue carries meaning only next to a text label (StatusChip rule)
  success: { light: "#2a7230", dark: "#7ccf80" },
  "success-soft": { light: "#e2f3e3", dark: "#1b2e1c" },
  warning: { light: "#8a5a00", dark: "#e6b24a" },
  "warning-soft": { light: "#fcf0d4", dark: "#332a12" },
  danger: { light: "#b9382f", dark: "#ef7a72" },
  "danger-soft": { light: "#fbe4e1", dark: "#3a1c1a" },
  info: { light: "#2f6db5", dark: "#79a9ec" },
  "info-soft": { light: "#e7f0fb", dark: "#182638" },

  // Scrim behind sheets and dialogs; used with an opacity modifier (`bg-overlay/50`)
  overlay: { light: "#000000", dark: "#000000" },
} as const satisfies Record<string, ColorToken>;

export type ColorName = keyof typeof colors;

/** Text colours that must stay readable on every surface. */
export const textColors = [
  "primary",
  "muted",
  "brand",
  "success",
  "warning",
  "danger",
  "info",
] as const;

/** Surfaces text is placed on. */
export const surfaceColors = ["surface", "surface-elevated", "surface-inset"] as const;

/** Status colours paired with their `-soft` background. */
export const statusColors = ["brand", "success", "warning", "danger", "info"] as const;
