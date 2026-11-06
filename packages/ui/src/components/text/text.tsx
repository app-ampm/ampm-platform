import { Text as NativeText, type TextProps as NativeTextProps } from "react-native";

import { cn } from "../../lib/cn";
import {
  DEFAULT_TONE,
  SINGLE_WEIGHT_VARIANTS,
  textStyles,
  type TextAlign,
  type TextTone,
  type TextVariant,
  type TextWeight,
} from "./text.styles";

export interface TextProps extends NativeTextProps {
  /**
   * Family and size: hero, display, title, heading and stat in Gilda Display; body, label, eyebrow and
   * data in Manrope; greeting in Rozha One (Devanagari greetings only).
   */
  readonly variant?: TextVariant | undefined;
  /** Defaults to pearl for headings and values, pearl 80% for body, pearl 58% for captions and eyebrows. */
  readonly tone?: TextTone | undefined;
  /** Applies to the Manrope variants; Gilda Display and Rozha One have one weight. */
  readonly weight?: TextWeight | undefined;
  readonly align?: TextAlign | undefined;
  readonly className?: string;
}

const HEADING_VARIANTS: ReadonlySet<TextVariant> = new Set([
  "hero",
  "display",
  "title",
  "heading",
  "subheading",
]);

const CAPPED_VARIANTS: ReadonlySet<TextVariant> = new Set(["hero", "display", "title", "stat"]);

/**
 * NativeWind cannot express `font-variant-numeric` on native (it warns and drops `tabular-nums`), so
 * the data variants also set React Native's own `fontVariant`: prices, dates and counts keep aligned
 * digits on iOS and Android as they do on the web. A constant, not a theme value.
 */
const TABULAR_VARIANTS: ReadonlySet<TextVariant> = new Set(["data", "mono"]);
const TABULAR_STYLE = { fontVariant: ["tabular-nums" as const] };

/**
 * The one way to put words on screen. Headings announce themselves as headers to screen readers;
 * font scaling stays on (accessibility rules), capped for the display sizes so layouts survive.
 *
 *   <Text variant="title">Find your venue</Text>
 *   <Text variant="eyebrow">Total discovery</Text>
 *   <Text variant="data">₹16,000–24,000</Text>
 *   <Text tone="muted" weight="medium">Indicative range, verified 12 March</Text>
 */
export function Text({
  variant = "body",
  tone,
  weight,
  align,
  className,
  accessibilityRole,
  style,
  ...rest
}: TextProps) {
  const role = accessibilityRole ?? (HEADING_VARIANTS.has(variant) ? "header" : undefined);
  const resolvedTone = tone ?? DEFAULT_TONE[variant] ?? "primary";
  const resolvedWeight = SINGLE_WEIGHT_VARIANTS.has(variant) ? "normal" : weight;
  return (
    <NativeText
      {...(role ? { accessibilityRole: role } : {})}
      maxFontSizeMultiplier={CAPPED_VARIANTS.has(variant) ? 1.3 : 2}
      className={cn(
        textStyles({ variant, tone: resolvedTone, weight: resolvedWeight, align }),
        className,
      )}
      style={TABULAR_VARIANTS.has(variant) ? [TABULAR_STYLE, style] : style}
      {...rest}
    />
  );
}
