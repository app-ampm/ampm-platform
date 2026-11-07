import { variants, type VariantProps } from "../../lib/variants";

/** The canvas: midnight under everything, the glow orbs above it, the content on top. */
export const screenStyles = variants("flex flex-1 flex-col bg-surface");

const WIDTH = {
  // Phone layouts and edge-to-edge desktop pages.
  full: "",
  // Reading and form pages on a desktop: one centred 768 column.
  content: "max-w-3xl self-center",
  // Dashboards and grids on a desktop: one centred 1152 column.
  wide: "max-w-6xl self-center",
} as const;

/**
 * The column that holds the header and the children: the 18px phone gutter (32 on a tablet, 48 on a
 * desktop), 16 between children, 16 at the top and 40 at the bottom, or room for a floating tab bar
 * (112: the 58 bar, its 26 from the edge, and air above it; the home indicator's inset comes on
 * top). Without scrolling it fills the screen.
 */
export const screenContentStyles = variants(
  "flex w-full flex-col gap-4 px-4.5 pt-4 md:px-8 lg:px-12",
  {
    variants: {
      width: WIDTH,
      room: { none: "pb-10", tabBar: "pb-28" },
      scroll: { true: "", false: "flex-1" },
    },
    defaultVariants: { width: "full", room: "none", scroll: true },
  },
);

export type ScreenContentStyleProps = VariantProps<typeof screenContentStyles>;
export type ScreenWidth = NonNullable<ScreenContentStyleProps["width"]>;

/** The sticky footer is base glass along the bottom edge: square corners and a top stroke only. */
export const screenFooterStyles = "rounded-none border-x-0 border-b-0";

/** The footer's content keeps the screen's gutter and column; the home indicator adds its own room. */
export const screenFooterContentStyles = variants("flex w-full px-4.5 pt-4 md:px-8 lg:px-12", {
  variants: {
    width: WIDTH,
    insetBelow: { true: "", false: "pb-4" },
  },
  defaultVariants: { width: "full", insetBelow: false },
});
