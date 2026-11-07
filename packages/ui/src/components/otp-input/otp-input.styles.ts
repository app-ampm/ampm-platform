import { variants, type VariantProps } from "../../lib/variants";

/** The row of cells, 8 apart. */
export const otpRowStyles = "flex flex-row gap-2";

/**
 * One cell of the code: 48 × 56 at radius 16 (the mock's 46 × 54 on the 4px scale), shrinking evenly
 * when the cells do not fit the width. Filled cells are peacock (25% fill, 70% stroke); the cell the
 * next digit goes into has the gold stroke and halo; empty cells a pearl 20% stroke on midnight 50%;
 * an error turns every stroke gold and keeps the digits.
 */
export const otpCellStyles = variants(
  "h-14 w-12 shrink items-center justify-center rounded border",
  {
    variants: {
      state: {
        empty: "border-primary/20 bg-surface/50",
        filled: "border-highlight/70 bg-highlight/25",
        active: "border-brand bg-surface/50 web:shadow-halo",
        error: "border-brand bg-surface/50",
        disabled: "border-dashed border-primary/26 bg-transparent",
      },
    },
    defaultVariants: { state: "empty" },
  },
);

/** The digit in a cell: Manrope 600 18, tabular (on top of the `data` text variant). */
export const otpDigitStyles = "text-xl";

/**
 * The one real field, laid over the cells. Opacity 5, not 0: iOS neither hit-tests nor reads out a
 * view under 1% opacity, so a fully transparent field could not be tapped or found by VoiceOver.
 * Its own text is transparent, so only the cells show the code.
 */
export const otpFieldStyles = "absolute inset-0 text-primary/0 opacity-5 web:outline-none";

export type OtpCellState = NonNullable<VariantProps<typeof otpCellStyles>["state"]>;
