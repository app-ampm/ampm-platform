import { variants, type VariantProps } from "../../lib/variants";

/**
 * Type styles. Variants pick the family and size; `weight` switches to the face that carries the
 * weight on native (tokens: one family per face) and adds the CSS weight on web.
 */
export const textStyles = variants("", {
  variants: {
    variant: {
      display: "font-display-semibold text-4xl tracking-tight",
      title: "font-display-semibold text-3xl",
      heading: "font-sans-semibold text-xl web:font-semibold",
      subheading: "font-sans-semibold text-lg web:font-semibold",
      body: "font-sans text-base",
      bodySmall: "font-sans text-sm",
      caption: "font-sans text-xs",
      label: "font-sans-medium text-sm web:font-medium",
      mono: "font-mono text-sm",
    },
    tone: {
      primary: "text-primary",
      muted: "text-muted",
      brand: "text-brand",
      onBrand: "text-brand-ink",
      success: "text-success",
      warning: "text-warning",
      danger: "text-danger",
      info: "text-info",
      inherit: "",
    },
    weight: {
      normal: "",
      medium: "font-sans-medium web:font-medium",
      semibold: "font-sans-semibold web:font-semibold",
      bold: "font-sans-bold web:font-bold",
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
