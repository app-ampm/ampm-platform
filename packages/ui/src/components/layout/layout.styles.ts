import { variants, type VariantProps } from "../../lib/variants";

/**
 * Spacing steps the layout components accept; full class names so Tailwind can see them. The half
 * steps are Peacock Night's: 6, 10, 14 (gaps and chip padding) and 18 (the gap between panels).
 */
export type Gap = 0 | 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 6 | 8;

export const gapClass: Record<Gap, string> = {
  0: "gap-0",
  1: "gap-1",
  1.5: "gap-1.5",
  2: "gap-2",
  2.5: "gap-2.5",
  3: "gap-3",
  3.5: "gap-3.5",
  4: "gap-4",
  4.5: "gap-4.5",
  6: "gap-6",
  8: "gap-8",
};

export const spacerClass: Record<Exclude<Gap, 0>, { vertical: string; horizontal: string }> = {
  1: { vertical: "h-1", horizontal: "w-1" },
  1.5: { vertical: "h-1.5", horizontal: "w-1.5" },
  2: { vertical: "h-2", horizontal: "w-2" },
  2.5: { vertical: "h-2.5", horizontal: "w-2.5" },
  3: { vertical: "h-3", horizontal: "w-3" },
  3.5: { vertical: "h-3.5", horizontal: "w-3.5" },
  4: { vertical: "h-4", horizontal: "w-4" },
  4.5: { vertical: "h-4.5", horizontal: "w-4.5" },
  6: { vertical: "h-6", horizontal: "w-6" },
  8: { vertical: "h-8", horizontal: "w-8" },
};

/**
 * Fixed side panels and list columns (`SplitPane`, `MasterDetail`): sm 288 (T5 and T12's 300) · md 320
 * · lg 384 (D8's 380, T3's side) · list 432 (T6's 430 queue).
 */
export type SidePanelWidth = "sm" | "md" | "lg" | "list";

export const sidePanelWidthClass: Record<SidePanelWidth, string> = {
  sm: "w-72",
  md: "w-80",
  lg: "w-96",
  list: "w-list",
};

export type Align = "start" | "center" | "end" | "stretch";
export type Justify = "start" | "center" | "end" | "between";

export const alignClass: Record<Align, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
};

export const justifyClass: Record<Justify, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
};

/**
 * The divider: a pearl 16% hairline (the guide's panel stroke and divider), stretched across the
 * parent's cross axis. `inset` leaves a card's padding (16) at both ends of a horizontal rule and 8 at
 * both ends of a vertical one.
 */
export const dividerStyles = variants("shrink-0 bg-primary/16", {
  variants: {
    orientation: {
      horizontal: "h-px self-stretch",
      vertical: "w-px self-stretch",
    },
    inset: { true: "", false: "" },
  },
  compoundVariants: [
    { orientation: "horizontal", inset: true, class: "mx-4" },
    { orientation: "vertical", inset: true, class: "my-2" },
  ],
  defaultVariants: { orientation: "horizontal", inset: false },
});

export type DividerStyleProps = VariantProps<typeof dividerStyles>;
export type DividerOrientation = NonNullable<DividerStyleProps["orientation"]>;
