import { variants, type VariantProps } from "../../lib/variants";

export const cardStyles = variants("rounded-lg border border-subtle bg-surface-elevated", {
  variants: {
    padding: { none: "p-0", sm: "p-3", md: "p-4", lg: "p-6" },
    elevated: { true: "shadow-sm", false: "" },
    pressable: {
      true: "active:bg-surface-inset web:transition-colors web:duration-base web:hover:bg-surface-inset web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-focus",
      false: "",
    },
  },
  defaultVariants: { padding: "md", elevated: false, pressable: false },
});

export type CardStyleProps = VariantProps<typeof cardStyles>;
export type CardPadding = NonNullable<CardStyleProps["padding"]>;
