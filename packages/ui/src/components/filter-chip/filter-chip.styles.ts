import { variants, type VariantProps } from "../../lib/variants";
import { focusRingStyles, groupFocusRingStyles } from "../glass-panel/glass-panel.styles";

/**
 * The selectable filter pill of the search screens ("Heritage", "Lake view", "Palace", "300+";
 * docs/design/peacock-night.md §6): a pearl 30% outline, and solid peacock with a midnight label when
 * selected. Manrope 600 at 13 on 14 × 8 padding: 38 tall. The 1px stroke stays in every state
 * (transparent when selected), so toggling a chip never shifts the row. Disabled is the shared dashed
 * look.
 *
 * The website's chip is one element, a toggle button with its own hover, press and focus:
 *
 *   <button aria-pressed={on} className={filterChipStyles({ selected: on })}>
 *     <span className={filterChipLabelStyles({ selected: on })}>Lake view</span>
 *   </button>
 *
 * In the app the pill sits inside its 44px target (`filterChipTargetStyles`), which takes focus,
 * hover and press for it (`nested`).
 */
export const filterChipStyles = variants(
  [
    "flex min-w-touch flex-row items-center justify-center gap-1.5 self-start rounded-full border",
    "px-3.5 py-2 web:transition-colors web:duration-base web:motion-reduce:transition-none",
  ],
  {
    variants: {
      selected: {
        true: "border-transparent bg-highlight",
        false: "border-primary/30 bg-transparent",
      },
      disabled: { true: "border-dashed border-primary/26 bg-transparent", false: "" },
      nested: { true: groupFocusRingStyles, false: focusRingStyles },
    },
    compoundVariants: [
      {
        selected: false,
        disabled: false,
        nested: false,
        className: "active:bg-primary/12 web:hover:bg-primary/8",
      },
      {
        selected: true,
        disabled: false,
        nested: false,
        className: "active:bg-highlight/85 web:hover:bg-highlight/85",
      },
      {
        selected: false,
        disabled: false,
        nested: true,
        className: "group-active:bg-primary/12 web:group-hover:bg-primary/8",
      },
      {
        selected: true,
        disabled: false,
        nested: true,
        className: "group-active:bg-highlight/85 web:group-hover:bg-highlight/85",
      },
    ],
    defaultVariants: { selected: false, disabled: false, nested: false },
  },
);

export type FilterChipStyleProps = VariantProps<typeof filterChipStyles>;

/**
 * The pressable around a chip's pill in the app: 4 above and below the 38 pill make a 46 target, and
 * the negative margins keep the row laid out as tall as the pill. It takes keyboard focus as the
 * `group` the pill shows the ring for.
 */
export const filterChipTargetStyles = variants(
  "group -my-1 flex self-start py-1 web:outline-none",
  {
    variants: {
      disabled: { true: "web:cursor-not-allowed", false: "web:cursor-pointer" },
    },
    defaultVariants: { disabled: false },
  },
);

/** The label: Manrope 600 at 13, pearl; midnight on the peacock fill; pearl 45% when disabled. */
export const filterChipLabelStyles = variants("font-sans-semibold text-sm web:font-semibold", {
  variants: {
    selected: { true: "text-highlight-ink", false: "text-primary" },
    disabled: { true: "text-primary/45", false: "" },
  },
  defaultVariants: { selected: false, disabled: false },
});
