import { variants, type VariantProps } from "../../lib/variants";

/** The canvas: midnight under everything, the glow orbs above it, the content on top. */
export const screenStyles = variants("flex flex-1 flex-col bg-surface");

/** The phone gutter (18), 32 on a tablet, 48 on a desktop: phone layouts and centred reading columns. */
const COLUMN_GUTTERS = "px-4.5 md:px-8 lg:px-12";

const WIDTH = {
  // Phone layouts and edge-to-edge pages.
  full: COLUMN_GUTTERS,
  // A form or a single reading column on a desktop: one centred 768 column.
  content: `max-w-3xl self-center ${COLUMN_GUTTERS}`,
  // A desktop artboard page (D2, D4, D7, T): its gutters come from the frame around it.
  wide: "px-4.5",
  // A list or split page (D5, D6, D8): the narrower portal gutter, lined up with the top navigation.
  split: "px-4.5",
} as const;

const FRAME = { none: "", topNav: "", rail: "" } as const;

/**
 * The column that holds the header and the children: 16 between children, 16 at the top and 40 at the
 * bottom on a phone, or room for a floating tab bar (112: the 58 bar, its 26 from the edge, and air
 * above it; the home indicator's inset comes on top), which phones alone draw. `wide` and `split`
 * pages take the artboards' gutters from their frame (`ScreenFrameProvider`):
 * - the portal's top navigation, or no navigation: the 1440 artboard frame, centred on wider windows,
 *   32 at the sides from 768; from 1024, 72 at the sides and 40 under the bar for `wide` (D2, D4, D7),
 *   32 and 24 for `split` (D5, D8), lined up with the bar;
 * - the workspace's rail: the page fills the window beside it, 18 from the rail, 30 at the right and
 *   the top (T1–T13).
 * Without scrolling it fills the screen.
 */
export const screenContentStyles = variants("flex w-full flex-col gap-4 pt-4", {
  variants: {
    width: WIDTH,
    frame: FRAME,
    room: { none: "pb-10", tabBar: "pb-28 md:pb-10" },
    scroll: { true: "", false: "flex-1" },
  },
  compoundVariants: [
    {
      width: ["wide", "split"],
      frame: ["none", "topNav"],
      class: "max-w-frame self-center md:px-8",
    },
    { width: "wide", frame: ["none", "topNav"], class: "lg:px-18 lg:pt-10" },
    { width: "split", frame: ["none", "topNav"], class: "lg:pt-6" },
    { width: ["wide", "split"], frame: "rail", class: "md:pl-4.5 md:pr-7.5 md:pt-7.5" },
  ],
  defaultVariants: { width: "full", frame: "none", room: "none", scroll: true },
});

export type ScreenContentStyleProps = VariantProps<typeof screenContentStyles>;
export type ScreenWidth = NonNullable<ScreenContentStyleProps["width"]>;

/** The sticky footer is base glass along the bottom edge: square corners and a top stroke only. */
export const screenFooterStyles = "rounded-none border-x-0 border-b-0";

/** The footer's content keeps the screen's gutters and column; the home indicator adds its own room. */
export const screenFooterContentStyles = variants("flex w-full pt-4", {
  variants: {
    width: WIDTH,
    frame: FRAME,
    insetBelow: { true: "", false: "pb-4" },
  },
  compoundVariants: [
    {
      width: ["wide", "split"],
      frame: ["none", "topNav"],
      class: "max-w-frame self-center md:px-8",
    },
    { width: "wide", frame: ["none", "topNav"], class: "lg:px-18" },
    { width: ["wide", "split"], frame: "rail", class: "md:pl-4.5 md:pr-7.5" },
  ],
  defaultVariants: { width: "full", frame: "none", insetBelow: false },
});
