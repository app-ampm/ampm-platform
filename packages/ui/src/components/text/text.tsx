import { Text as NativeText, type TextProps as NativeTextProps } from "react-native";

import { cn } from "../../lib/cn";
import {
  textStyles,
  type TextAlign,
  type TextTone,
  type TextVariant,
  type TextWeight,
} from "./text.styles";

export interface TextProps extends NativeTextProps {
  /** Family and size: display and title for Fraunces headings, body for Source Sans 3, mono for code. */
  readonly variant?: TextVariant | undefined;
  readonly tone?: TextTone | undefined;
  /** Applies to the sans variants; display and mono carry their own faces. */
  readonly weight?: TextWeight | undefined;
  readonly align?: TextAlign | undefined;
  readonly className?: string;
}

const HEADING_VARIANTS: ReadonlySet<TextVariant> = new Set([
  "display",
  "title",
  "heading",
  "subheading",
]);

/**
 * The one way to put words on screen. Headings announce themselves as headers to screen readers;
 * font scaling stays on (accessibility rules), capped for the display sizes so layouts survive.
 *
 *   <Text variant="heading">Hotels</Text>
 *   <Text tone="muted" weight="medium">Indicative range, verified 12 March</Text>
 */
export function Text({
  variant = "body",
  tone,
  weight,
  align,
  className,
  accessibilityRole,
  ...rest
}: TextProps) {
  const role = accessibilityRole ?? (HEADING_VARIANTS.has(variant) ? "header" : undefined);
  return (
    <NativeText
      {...(role ? { accessibilityRole: role } : {})}
      maxFontSizeMultiplier={variant === "display" || variant === "title" ? 1.3 : 2}
      className={cn(textStyles({ variant, tone, weight, align }), className)}
      {...rest}
    />
  );
}
