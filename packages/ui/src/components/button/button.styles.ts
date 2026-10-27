import { variants, type VariantProps } from "../../lib/variants";

/** Every size keeps the 44px minimum target; `sm` only tightens padding and type. */
export const buttonStyles = variants(
  [
    "flex-row items-center justify-center gap-2 rounded",
    "web:transition-colors web:duration-base web:focus-visible:outline-none",
    "web:focus-visible:ring-2 web:focus-visible:ring-focus web:focus-visible:ring-offset-2 web:focus-visible:ring-offset-surface",
    "disabled:opacity-50",
  ],
  {
    variants: {
      variant: {
        primary: "bg-brand active:bg-brand/90 web:hover:bg-brand/90",
        secondary:
          "border border-strong bg-surface-elevated active:bg-surface-inset web:hover:bg-surface-inset",
        ghost: "bg-transparent active:bg-surface-inset web:hover:bg-surface-inset",
        destructive: "bg-danger active:bg-danger/90 web:hover:bg-danger/90",
      },
      size: {
        sm: "min-h-touch px-3",
        md: "min-h-touch px-4",
        lg: "min-h-12 px-6",
      },
      fullWidth: {
        true: "self-stretch",
        false: "self-start",
      },
    },
    defaultVariants: { variant: "primary", size: "md", fullWidth: false },
  },
);

export type ButtonStyleProps = VariantProps<typeof buttonStyles>;
export type ButtonVariant = NonNullable<ButtonStyleProps["variant"]>;
export type ButtonSize = NonNullable<ButtonStyleProps["size"]>;

export const buttonLabelTone = {
  primary: "onBrand",
  secondary: "primary",
  ghost: "brand",
  destructive: "onBrand",
} as const;

export const buttonLabelVariant = { sm: "label", md: "subheading", lg: "subheading" } as const;
