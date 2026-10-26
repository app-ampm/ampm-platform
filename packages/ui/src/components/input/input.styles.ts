import { variants, type VariantProps } from "../../lib/variants";

/** The field frame; focus is tracked in React so web and native show the same ring. */
export const fieldStyles = variants(
  "flex-row items-center gap-2 rounded border bg-surface-elevated px-3",
  {
    variants: {
      state: {
        default: "border-strong",
        focused: "border-brand web:ring-2 web:ring-focus web:ring-offset-0",
        error: "border-danger",
        disabled: "border-subtle bg-surface-inset opacity-60",
      },
      size: {
        md: "min-h-touch",
        lg: "min-h-12",
      },
    },
    defaultVariants: { state: "default", size: "md" },
  },
);

export type FieldStyleProps = VariantProps<typeof fieldStyles>;
export type InputSize = NonNullable<FieldStyleProps["size"]>;
