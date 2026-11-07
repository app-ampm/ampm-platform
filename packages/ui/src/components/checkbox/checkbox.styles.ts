import { variants, type VariantProps } from "../../lib/variants";
import { groupFocusRingStyles } from "../glass-panel/glass-panel.styles";

/**
 * The whole row is the pressable, at least 44 tall: the box, then the label and description. The
 * box sits on the first line, so a label that wraps (a consent sentence) reads from the top.
 */
export const checkboxRowStyles = variants(
  "group flex min-h-touch flex-row items-start gap-3 py-2.5 web:outline-none",
  {
    variants: {
      disabled: { true: "web:cursor-not-allowed", false: "web:cursor-pointer" },
    },
    defaultVariants: { disabled: false },
  },
);

/**
 * The 22 box at radius 7: peacock with a midnight check when ticked, a pearl 34% stroke when not; an
 * error turns the stroke gold; the web adds a pearl 8% hover fill and the gold halo on keyboard focus.
 */
export const checkboxBoxStyles = variants(
  [
    "flex h-5.5 w-5.5 items-center justify-center rounded-sm border",
    "web:transition-colors web:duration-fast web:motion-reduce:transition-none",
    groupFocusRingStyles,
  ],
  {
    variants: {
      checked: {
        true: "border-highlight bg-highlight",
        false: "border-primary/34 bg-transparent",
      },
      invalid: { true: "border-brand", false: "" },
      disabled: { true: "opacity-45", false: "" },
    },
    compoundVariants: [
      { checked: false, disabled: false, className: "web:group-hover:bg-primary/8" },
      { checked: true, disabled: false, className: "web:group-hover:bg-highlight/85" },
    ],
    defaultVariants: { checked: false, invalid: false, disabled: false },
  },
);

/**
 * The label and description beside the box; the 1px top keeps the first line centred on it. `flex`
 * keeps the column on the web's DOM too.
 */
export const checkboxTextStyles = "flex flex-1 flex-col gap-0.5 pt-px";

export type CheckboxBoxStyleProps = VariantProps<typeof checkboxBoxStyles>;
