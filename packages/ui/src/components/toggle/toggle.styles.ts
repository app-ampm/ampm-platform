import { spacingPx } from "@ampm/tokens";

import { variants, type VariantProps } from "../../lib/variants";
import { groupFocusRingStyles } from "../glass-panel/glass-panel.styles";

/** The whole row is the pressable: the label and description, then the switch at its end. */
export const toggleRowStyles = variants(
  "group flex min-h-touch flex-row items-center gap-3 web:outline-none",
  {
    variants: {
      disabled: { true: "web:cursor-not-allowed", false: "web:cursor-pointer" },
    },
    defaultVariants: { disabled: false },
  },
);

/**
 * The 48 × 28 track (the mock's 46 × 26 on the 4px scale): gold when on, pearl 12% when off, raised
 * on hover and, on keyboard focus (web), the gold border plus halo every focusable shows. The border
 * is transparent until then and drawn inside the fixed size, so the track never grows. Disabled dims
 * the whole switch.
 */
export const toggleTrackStyles = variants(
  [
    "h-7 w-12 items-center justify-center rounded-full border border-transparent",
    "web:transition-colors web:duration-fast web:motion-reduce:transition-none",
    groupFocusRingStyles,
  ],
  {
    variants: {
      on: { true: "bg-brand", false: "bg-primary/12" },
      disabled: { true: "opacity-45", false: "" },
    },
    compoundVariants: [
      { on: true, disabled: false, className: "web:group-hover:bg-brand/85" },
      { on: false, disabled: false, className: "web:group-hover:bg-primary/20" },
    ],
    defaultVariants: { on: false, disabled: false },
  },
);

/** The 22 knob, 3 in from every edge: midnight on the gold track, pearl 45% on the pearl one. */
export const toggleKnobStyles = variants("h-5.5 w-5.5 rounded-full", {
  variants: {
    on: { true: "bg-brand-ink", false: "bg-primary/45" },
  },
  defaultVariants: { on: false },
});

/**
 * How far the centred knob slides either way: half of the track's width less its height (w-12, h-7),
 * which keeps the inset even. Read from the same spacing tokens as the classes; the track measures
 * itself once laid out, so a scaled root font size on the web keeps the inset even too.
 */
export const TOGGLE_KNOB_TRAVEL = (spacingPx["12"] - spacingPx["7"]) / 2;

export type ToggleTrackStyleProps = VariantProps<typeof toggleTrackStyles>;
