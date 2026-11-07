import { cn } from "../../lib/cn";
import { variants, type VariantProps } from "../../lib/variants";
import { flatTintStyles, focusRingStyles } from "../glass-panel/glass-panel.styles";

const PRESSABLE = cn(
  "min-h-touch web:cursor-pointer web:transition-colors web:duration-base web:motion-reduce:transition-none",
  focusRingStyles,
);

/**
 * A row inside a panel: "My selection", enquiries, leads. `flat` is the nested flat tint (pearl 6%,
 * pearl 12% stroke) at radius 16 with 14 × 12 padding. `plain` has no fill and a pearl 16% hairline
 * above each row, the way the mocks' lists sit under their panel's header (P2, D4, T5), so the last
 * row ends the panel clean. Pressable rows keep the 44px target, raise the stroke on hover, deepen the
 * tint while pressed and show the gold focus border plus halo.
 *
 * The website (plain DOM) uses the same recipe on an <a> or a <div>, hence `flex` in the base:
 *
 *   <a className={listItemStyles({ tone: "flat", pressable: true })}>…</a>
 */
export const listItemStyles = variants("flex flex-row items-center gap-3", {
  variants: {
    tone: {
      flat: cn("rounded px-3.5 py-3", flatTintStyles),
      plain: "border-t border-primary/16 py-3",
    },
    pressable: { true: PRESSABLE, false: "" },
  },
  compoundVariants: [
    { tone: "flat", pressable: true, class: "active:bg-primary/12 web:hover:border-primary/24" },
    { tone: "plain", pressable: true, class: "active:bg-primary/6 web:hover:border-primary/24" },
  ],
  defaultVariants: { tone: "flat", pressable: false },
});

export type ListItemStyleProps = VariantProps<typeof listItemStyles>;
export type ListItemTone = NonNullable<ListItemStyleProps["tone"]>;
