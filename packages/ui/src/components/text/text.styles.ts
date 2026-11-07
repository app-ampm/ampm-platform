import { variants, type VariantProps } from "../../lib/variants";

/**
 * Peacock Night type styles. Gilda Display carries the display variants (one weight, never bolded),
 * Manrope everything else; `weight` switches to the face that carries the weight on native (tokens:
 * one family per face) and adds the CSS weight on the web. Pearl strengths: 100% headings and values,
 * 80% body, 58% labels and metadata, 45% disabled.
 */
export const textStyles = variants("", {
  variants: {
    variant: {
      // Gilda Display
      hero: "font-display text-7xl", // 88 · website heroes
      display: "font-display text-6xl", // 64 · page titles
      title: "font-display text-4xl", // 36 · screen titles
      heading: "font-display text-2xl", // 24 · card titles, sections in a screen
      stat: "font-display text-6xl", // 64 · countdowns and KPIs (not a heading)
      wordmark: "font-display text-2xl tracking-wordmark", // the "AMPM" wordmark until a logo exists
      // Manrope
      subheading: "font-sans-semibold text-lg web:font-semibold", // 16 · strong interface labels
      body: "font-sans text-base", // 15 / 1.6
      bodySmall: "font-sans text-sm", // 13
      caption: "font-sans text-xs", // 11
      label: "font-sans-semibold text-sm web:font-semibold", // 13 · interface labels
      eyebrow: "font-sans-semibold text-2xs uppercase tracking-eyebrow web:font-semibold", // 10
      data: "font-sans-semibold text-sm tabular-nums web:font-semibold", // prices, dates, counts
      // Retired monospace: renders as `data`.
      mono: "font-sans-semibold text-sm tabular-nums web:font-semibold",
      // Rozha One: Devanagari greetings ("शुभ विवाह") only, never interface text
      greeting: "font-devanagari text-2xl",
    },
    tone: {
      primary: "text-primary",
      body: "text-body",
      muted: "text-muted",
      disabled: "text-primary/45",
      brand: "text-brand",
      // Peacock on midnight is 4.25:1: display-size text and icons only, never small text.
      highlight: "text-highlight",
      onBrand: "text-brand-ink",
      onHighlight: "text-highlight-ink",
      // Status words: the word carries the meaning, so these are pearl, gold or peacock like the chips.
      success: "text-highlight",
      warning: "text-brand",
      danger: "text-brand",
      info: "text-primary",
      inherit: "",
    },
    weight: {
      normal: "",
      medium: "font-sans-medium web:font-medium",
      semibold: "font-sans-semibold web:font-semibold",
      bold: "font-sans-bold web:font-bold",
      extrabold: "font-sans-extrabold web:font-extrabold",
    },
    align: {
      left: "text-left",
      center: "text-center",
      right: "text-right",
    },
  },
  defaultVariants: { variant: "body", tone: "primary", weight: "normal", align: "left" },
});

export type TextStyleProps = VariantProps<typeof textStyles>;
export type TextVariant = NonNullable<TextStyleProps["variant"]>;
export type TextTone = NonNullable<TextStyleProps["tone"]>;
export type TextWeight = NonNullable<TextStyleProps["weight"]>;
export type TextAlign = NonNullable<TextStyleProps["align"]>;

/** Gilda Display and Rozha One ship one weight: `weight` never applies to these. */
export const SINGLE_WEIGHT_VARIANTS: ReadonlySet<TextVariant> = new Set([
  "hero",
  "display",
  "title",
  "heading",
  "stat",
  "wordmark",
  "greeting",
]);

/** The strength a variant takes when no tone is given: body 80%, labels and metadata 58%. */
export const DEFAULT_TONE: Partial<Record<TextVariant, TextTone>> = {
  body: "body",
  bodySmall: "body",
  caption: "muted",
  eyebrow: "muted",
};
