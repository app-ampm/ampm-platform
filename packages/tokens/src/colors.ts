/**
 * Colour tokens: Peacock Night (docs/design/peacock-night.md), the approved AMPM visual system.
 * Semantic names only: the class is `bg-surface`, `text-primary`, `border-subtle`, `bg-brand`,
 * `bg-highlight` (.claude/rules/styling.md); the four palette names never leave this package.
 *
 * Four colours exist and nothing else:
 *   Midnight #0E1534 · Peacock #138A85 · Gold #DDB861 · Pearl #F1EBDD
 * There is no white, grey, green, red or blue. Every other value is one of the four at an opacity,
 * reached one of two ways:
 *   - an opaque token below, pre-blended onto midnight (text strengths, native glass fallbacks);
 *   - an opacity modifier on a token that IS one of the four, with a step from opacity.ts:
 *     `bg-surface/50` (midnight), `border-primary/16` (pearl), `bg-brand/14` (gold),
 *     `bg-highlight/30` (peacock). Glass, strokes and tints use this form.
 *
 * Roles: midnight is the canvas and the ink on gold and peacock; gold (`brand`) is the action colour
 * (one primary action per screen, the emphasised word, live, needs-you, focus); peacock (`highlight`)
 * is the highlight (active tab or segment, verified, done, ready, offline-safe); pearl is all text and
 * strokes. Proportion on a screen: about midnight 72%, pearl 16%, peacock 8%, gold 4%.
 *
 * Dark only: `light` and `dark` hold the same value on purpose, so the scheme switch has no effect.
 * The status hues are retired: `success`, `warning`, `danger` and `info` now name the four StatusChip
 * treatments (peacock solid, gold soft, gold solid, pearl outline); the word in the chip carries the
 * meaning. `tokens:build` checks every pair in `contrastPairs` and fails below its minimum.
 */

export type Hex = `#${string}`;

export interface ColorToken {
  readonly light: Hex;
  readonly dark: Hex;
}

/** The four colours. Internal to the tokens: components use the semantic names below. */
export const palette = {
  midnight: "#0E1534",
  peacock: "#138A85",
  gold: "#DDB861",
  pearl: "#F1EBDD",
} as const satisfies Record<string, Hex>;

const same = (hex: Hex): ColorToken => ({ light: hex, dark: hex });

export const colors = {
  // Surfaces. Glass (glass.ts) is the panel material; these opaque values are its native fallbacks
  // and the flat tints for items nested inside a glass panel.
  surface: same(palette.midnight), // midnight: page canvas, glass fill (`bg-surface/50`)
  "surface-elevated": same("#1D2440"), // pearl 6% on midnight: base glass fallback
  "surface-inset": same("#161D3A"), // pearl 3% on midnight: wells inside panels

  // Text, pearl at fixed strengths: 100% headings and values, 80% body, 58% labels and metadata.
  // Disabled text is `text-primary/45`.
  primary: same(palette.pearl),
  body: same("#C6C2BD"),
  muted: same("#9A9AA0"),

  // Lines and focus
  subtle: same("#2E344D"), // pearl 16%: panel strokes, dividers (translucent: `border-primary/16`)
  strong: same("#5C6074"), // pearl 40%: outline buttons, checkboxes (translucent: `border-primary/40`)
  focus: same(palette.gold), // gold border plus the 4px gold 18% halo (`shadow-halo`)

  // Action: gold, and the midnight ink that sits on it
  brand: same(palette.gold),
  "brand-ink": same(palette.midnight),
  "brand-soft": same("#36373E"), // gold 16% on midnight: waiting chips, gold glass fallback

  // Highlight: peacock, and the midnight ink that sits on it
  highlight: same(palette.peacock),
  "highlight-ink": same(palette.midnight),
  "highlight-soft": same("#0F4157"), // peacock 30% on midnight: peacock glass fallback

  // StatusChip treatments (the word in the chip carries the meaning, never the colour alone)
  success: same(palette.peacock), // peacock solid, midnight text: Verified, Done, Ready, Confirmed
  "success-soft": same("#0F4157"),
  warning: same(palette.gold), // gold text on gold soft: Awaiting hotel, Due 15 Dec
  "warning-soft": same("#36373E"),
  danger: same(palette.gold), // gold solid, midnight text: Needs approval, 2 blocked
  "danger-soft": same("#36373E"),
  info: same(palette.pearl), // pearl outline: Indicative, Submitted
  "info-soft": same("#1D2440"),

  // Scrim behind sheets and dialogs, used with an opacity step (`bg-overlay/70`)
  overlay: same(palette.midnight),
} as const satisfies Record<string, ColorToken>;

export type ColorName = keyof typeof colors;

/** Text colours that must stay readable on every neutral surface. */
export const textColors = ["primary", "body", "muted", "brand"] as const;

/** Neutral surfaces text is placed on. */
export const surfaceColors = ["surface", "surface-elevated", "surface-inset"] as const;

/** The colours that carry a status treatment (see `contrastPairs`). */
export const statusColors = ["brand", "success", "warning", "danger", "info"] as const;

/** WCAG AA for body text. */
export const MIN_TEXT_CONTRAST = 4.5;

export interface ContrastPair {
  readonly text: ColorName;
  readonly on: ColorName;
  /** Defaults to MIN_TEXT_CONTRAST; anything lower is an exception and must say why. */
  readonly min?: number;
  readonly use: string;
}

const neutralPairs: ContrastPair[] = textColors.flatMap((text) =>
  surfaceColors.map((on) => ({ text, on, use: `${text} text on ${on}` })),
);

/**
 * Every text-on-fill pair the system uses; `tokens:build` fails if one drops below its minimum.
 * The status pairs follow the StatusChip table in docs/design/peacock-night.md.
 */
export const contrastPairs: readonly ContrastPair[] = [
  ...neutralPairs,
  // Text inside the coloured glass recipes (their opaque fallbacks are the worst case)
  { text: "primary", on: "highlight-soft", use: "pearl text on peacock glass" },
  { text: "body", on: "highlight-soft", use: "pearl 80% text on peacock glass" },
  { text: "primary", on: "brand-soft", use: "pearl text on gold glass" },
  { text: "body", on: "brand-soft", use: "pearl 80% text on gold glass" },
  // Actions
  { text: "brand-ink", on: "brand", use: "primary button, needs-you chip" },
  // Status chips
  { text: "info", on: "surface", use: "outline chip: Indicative, Submitted" },
  { text: "warning", on: "warning-soft", use: "waiting chip: Awaiting hotel" },
  { text: "brand-ink", on: "danger", use: "needs-you chip: Needs approval" },
  { text: "muted", on: "info-soft", use: "inactive chip: Stale (pearl 8% fill)" },
  {
    text: "highlight-ink",
    on: "highlight",
    min: 3,
    use:
      "midnight on peacock: verified chip, active tab and segment, highlight button. " +
      "4.25:1 as approved (WCAG AA large text and UI components); below 4.5:1 for the 11–16px labels, " +
      "pending AMPM's call between the approved peacock and #148F8A (4.53:1).",
  },
  {
    text: "highlight-ink",
    on: "success",
    min: 3,
    use: "verified chip (same pair as midnight on peacock)",
  },
];
