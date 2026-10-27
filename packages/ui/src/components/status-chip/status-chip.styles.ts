import { variants, type VariantProps } from "../../lib/variants";

export const chipStyles = variants("flex-row items-center gap-1 self-start rounded-full", {
  variants: {
    tone: {
      neutral: "bg-surface-inset",
      info: "bg-info-soft",
      success: "bg-success-soft",
      warning: "bg-warning-soft",
      danger: "bg-danger-soft",
      brand: "bg-brand-soft",
    },
    size: { sm: "px-2 py-0.5", md: "px-3 py-1" },
  },
  defaultVariants: { tone: "neutral", size: "md" },
});

export type ChipStyleProps = VariantProps<typeof chipStyles>;
export type StatusTone = NonNullable<ChipStyleProps["tone"]>;
export type ChipSize = NonNullable<ChipStyleProps["size"]>;

export const chipTextTone = {
  neutral: "primary",
  info: "info",
  success: "success",
  warning: "warning",
  danger: "danger",
  brand: "brand",
} as const;
