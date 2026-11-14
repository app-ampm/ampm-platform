import { variants, type VariantProps } from "../../lib/variants";
import { focusRingStyles, groupFocusRingStyles } from "../glass-panel/glass-panel.styles";
import { textStyles } from "../text/text.styles";

const TRACK_FRAME = "rounded-full border border-primary/16 bg-surface/50";
const TRACK_LAYOUT = "flex flex-row gap-1 p-1";
/** The underline strip has no track: the tabs sit on the canvas, 8 apart (T3, T5). */
const UNDERLINE_LAYOUT = "flex flex-row gap-2";

/**
 * The pill track: midnight 50% with a pearl 16% stroke and 4 inside, segments 4 apart. It hugs its
 * segments, or spans the width with `fullWidth` and shares it equally between them.
 *
 *   <div role="tablist" className={segmentedTrackStyles({ fullWidth: true })}>
 *     <button role="tab" aria-selected className={segmentStyles({ selected: true, fullWidth: true })}>
 *       <span className={segmentLabelStyles({ state: "selected" })}>Request a demo</span>
 *     </button>
 *   </div>
 */
export const segmentedTrackStyles = variants("", {
  variants: {
    variant: { pill: [TRACK_FRAME, TRACK_LAYOUT], underline: UNDERLINE_LAYOUT },
    fullWidth: { true: "self-stretch", false: "self-start" },
  },
  defaultVariants: { variant: "pill", fullWidth: false },
});

/** The scrollable strip (the hotel page tabs): the track spans the width, segments scroll inside. */
export const segmentedScrollStyles = variants("grow-0 self-stretch overflow-hidden", {
  variants: {
    variant: { pill: TRACK_FRAME, underline: "" },
  },
  defaultVariants: { variant: "pill" },
});

/**
 * The strip's scrolling content. It keeps the track's 4 around the segments, except that a small
 * strip takes 6 above and below: a scroll view clips at its edges, and a small segment's 44px target
 * reaches 6 past its pill.
 */
export const segmentedScrollContentStyles = variants("flex flex-row", {
  variants: {
    size: { sm: "px-1 py-1.5", md: "p-1" },
  },
  defaultVariants: { size: "md" },
});

/**
 * In the app, the segments and the sliding pill share a row with no padding of its own, so where a
 * segment is measured is where the pill goes. The row fills the width of a full-width track.
 */
export const segmentedRowStyles = variants("relative flex grow flex-row", {
  variants: {
    variant: { pill: "gap-1", underline: "gap-2" },
  },
  defaultVariants: { variant: "pill" },
});

/**
 * The selection mark that slides to the next selection: the peacock pill behind the selected segment,
 * or a 2px gold line under the selected tab of an underline strip (T3 Activity, T5 Rate cards).
 */
export const segmentIndicatorStyles = variants("absolute left-0", {
  variants: {
    variant: {
      pill: "inset-y-0 rounded-full bg-highlight",
      underline: "bottom-0 h-0.5 rounded-full bg-brand",
    },
  },
  defaultVariants: { variant: "pill" },
});

/**
 * A segment: a pill, peacock when selected; a pearl 8% fill on hover (web) or press when not; the gold
 * border and halo on keyboard focus (web), on a stroke that is transparent until then. `sm` tightens
 * the padding only, so the label stays Manrope 600 13: the pill is 38 tall (md) or 34 (sm).
 *
 * The website's segment is one element: the pill is the button, with its own hover, press and focus.
 * In the app the pill sits inside its 44px target (`segmentTargetStyles`), which takes focus, hover and
 * press (`nested`), and the sliding pill paints the selected segment once it is measured (`indicator`).
 */
export const segmentStyles = variants(
  [
    "flex min-w-touch flex-row items-center justify-center rounded-full border border-transparent",
    "bg-transparent web:transition-colors web:duration-fast web:motion-reduce:transition-none",
  ],
  {
    variants: {
      size: { sm: "px-3 py-1.5", md: "px-4 py-2" },
      variant: { pill: "", underline: "" },
      selected: { true: "", false: "" },
      indicator: { true: "", false: "" },
      disabled: { true: "web:cursor-not-allowed", false: "web:cursor-pointer" },
      fullWidth: { true: "flex-1", false: "" },
      nested: { true: groupFocusRingStyles, false: focusRingStyles },
    },
    compoundVariants: [
      // An underline tab is marked by its label until the gold line is measured under it.
      { variant: "pill", selected: true, indicator: false, className: "bg-highlight" },
      {
        selected: false,
        disabled: false,
        nested: false,
        className: "active:bg-primary/8 web:hover:bg-primary/8",
      },
      {
        selected: false,
        disabled: false,
        nested: true,
        className: "group-active:bg-primary/8 web:group-hover:bg-primary/8",
      },
    ],
    defaultVariants: {
      size: "md",
      variant: "pill",
      selected: false,
      indicator: false,
      disabled: false,
      fullWidth: false,
      nested: false,
    },
  },
);

/**
 * The pressable around a segment's pill in the app: at least 44 tall (8 or 12 more than the 38 or 34
 * pill), while the negative margins keep the row as tall as the pills, so the track keeps its 4 around
 * them. It takes keyboard focus as the `group` the pill shows the ring for. Every target reaches the
 * edge of the track's padding (md) or 2 past it (sm, which a static track does not clip).
 */
export const segmentTargetStyles = variants("group flex web:outline-none", {
  variants: {
    size: { sm: "-my-1.5 py-1.5", md: "-my-1 py-1" },
    disabled: { true: "web:cursor-not-allowed", false: "web:cursor-pointer" },
    fullWidth: { true: "flex-1", false: "" },
  },
  defaultVariants: { size: "md", disabled: false, fullWidth: false },
});

/**
 * The label: midnight on the peacock pill, pearl 80% beside it, pearl 45% when disabled. On an underline
 * strip the selected tab's label is pearl 100% over its gold line.
 */
export const segmentLabelStyles = variants(
  textStyles({ variant: "label", tone: "inherit", align: "center" }),
  {
    variants: {
      state: {
        selected: "text-highlight-ink",
        default: "text-body",
        disabled: "text-primary/45",
      },
      variant: { pill: "", underline: "" },
    },
    compoundVariants: [{ variant: "underline", state: "selected", className: "text-primary" }],
    defaultVariants: { state: "default", variant: "pill" },
  },
);

export type SegmentStyleProps = VariantProps<typeof segmentStyles>;
export type SegmentedControlSize = NonNullable<SegmentStyleProps["size"]>;
/** pill (default): the peacock pill on a track · underline: tabs over a sliding gold line (T3, T5). */
export type SegmentedControlVariant = NonNullable<SegmentStyleProps["variant"]>;
export type SegmentLabelState = NonNullable<VariantProps<typeof segmentLabelStyles>["state"]>;
