import { cn } from "../../lib/cn";
import { variants, type VariantProps } from "../../lib/variants";
import { focusRingStyles, glassRecipes } from "../glass-panel/glass-panel.styles";
import type { IconSize, IconTone } from "../icon/icon.types";
import { textStyles, type TextTone } from "../text/text.styles";

const glass = glassRecipes.base;

/**
 * Peacock Night buttons (docs/design/peacock-night.md §6): pills in Manrope 700.
 *
 *   primary      gold fill, midnight label, hovered and pressed gold 85%      one per screen
 *   secondary    pearl 40% outline, pearl label, hover pearl 8%               Explore palaces
 *   highlight    peacock fill, midnight label, hovered and pressed 85%        Approve version 3
 *   glass        base glass without blur, pearl label, hover stroke 24%       over photos, back
 *   ghost        text only, pearl label, hover pearl 8%                       Not now
 *   destructive  gold outline, gold label (Peacock Night has no red)          Remove hotel
 *
 * Every variant carries a 1px stroke (transparent on the fills), so all of them stand the same size
 * and the focus border shows. Disabled is one look for every variant: transparent, dashed pearl 26%,
 * pearl 45% label. The hover and pressed tints are compound variants of the enabled state, so a
 * disabled button never lights up under the pointer. Icon-only buttons are circles.
 *
 * The website (plain DOM) uses the same recipes on a <button> or an <a>, which is why the base
 * carries `flex`:
 *
 *   <button className={buttonStyles({ variant: "secondary" })}>
 *     <span className={buttonLabelStyles({ variant: "secondary" })}>Explore palaces</span>
 *   </button>
 */
export const buttonStyles = variants(
  [
    "flex flex-row items-center justify-center gap-2 rounded-full border py-2",
    "web:transition-colors web:duration-base web:motion-reduce:transition-none",
    focusRingStyles,
  ],
  {
    variants: {
      variant: {
        primary: "border-transparent bg-brand",
        secondary: "border-primary/40 bg-transparent",
        highlight: "border-transparent bg-highlight",
        glass: `${glass.stroke} ${glass.fill}`,
        ghost: "border-transparent bg-transparent",
        destructive: "border-brand/50 bg-transparent",
      },
      // The 44px minimum target in every size; `sm` only tightens the padding and the type.
      size: {
        sm: "min-h-touch px-5",
        md: "min-h-touch px-6",
        lg: "min-h-12 px-7",
      },
      fullWidth: { true: "self-stretch", false: "self-start" },
      iconOnly: { true: "px-0", false: "" },
      disabled: { true: "border-dashed border-primary/26 bg-transparent", false: "" },
    },
    compoundVariants: [
      {
        variant: "primary",
        disabled: false,
        className: "active:bg-brand/85 web:hover:bg-brand/85",
      },
      {
        variant: "secondary",
        disabled: false,
        className: "active:bg-primary/12 web:hover:bg-primary/8",
      },
      {
        variant: "highlight",
        disabled: false,
        className: "active:bg-highlight/85 web:hover:bg-highlight/85",
      },
      {
        variant: "glass",
        disabled: false,
        className: `${glass.webRim} active:bg-surface/70 web:hover:border-primary/24`,
      },
      {
        variant: "ghost",
        disabled: false,
        className: "active:bg-primary/12 web:hover:bg-primary/8",
      },
      {
        variant: "destructive",
        disabled: false,
        className: "active:bg-brand/14 web:hover:bg-brand/8",
      },
      // Icon-only: a circle as tall as the size.
      { iconOnly: true, size: ["sm", "md"], className: "h-touch w-touch" },
      { iconOnly: true, size: "lg", className: "h-12 w-12" },
    ],
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
      iconOnly: false,
      disabled: false,
    },
  },
);

export type ButtonStyleProps = VariantProps<typeof buttonStyles>;
export type ButtonVariant = NonNullable<ButtonStyleProps["variant"]>;
export type ButtonSize = NonNullable<ButtonStyleProps["size"]>;

/** The label's ink as a Text and Icon tone; icons and the busy indicator match the label. */
export const buttonLabelTone = {
  primary: "onBrand",
  secondary: "primary",
  highlight: "onHighlight",
  glass: "primary",
  ghost: "primary",
  destructive: "brand",
} as const satisfies Record<ButtonVariant, TextTone & IconTone>;

const LABEL_SIZE = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
} as const satisfies Record<ButtonSize, string>;

export interface ButtonLabelStyleProps {
  readonly variant?: ButtonVariant | undefined;
  readonly size?: ButtonSize | undefined;
  readonly disabled?: boolean | undefined;
}

/**
 * The label's classes: Manrope 700 at 13 (sm), 15 (md) or 16 (lg) in the variant's ink, pearl 45%
 * when disabled. Built from the Text styles, so the website's <span> and the Button's Text match.
 *
 *   <span className={buttonLabelStyles({ variant: "highlight", size: "lg" })}>Approve version 3</span>
 */
export function buttonLabelStyles({
  variant = "primary",
  size = "md",
  disabled = false,
}: ButtonLabelStyleProps = {}): string {
  const tone = disabled ? "disabled" : buttonLabelTone[variant];
  return cn(
    textStyles({ variant: "label", tone, weight: "bold", align: "center" }),
    LABEL_SIZE[size],
  );
}

/** Icons beside a label follow the type (16, or 20 on lg); an icon-only circle carries 20 or 24. */
export function buttonIconSize(size: ButtonSize, iconOnly: boolean): IconSize {
  if (iconOnly) return size === "lg" ? "lg" : "md";
  return size === "lg" ? "md" : "sm";
}
