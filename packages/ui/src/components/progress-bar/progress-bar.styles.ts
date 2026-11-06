import { variants, type VariantProps } from "../../lib/variants";

/**
 * Peacock Night's progress bar: a pill track in pearl 12% with a peacock fill (gold for a countdown or
 * something that needs the person). 4, 6 or 8 tall, as the mocks draw it (readiness 8, the RSVP wizard 4).
 * The website reuses these recipes on plain DOM elements, so every flex recipe also sets `flex`.
 *
 *   <div className={progressTrackStyles({ size: "lg" })}>
 *     <div className={progressFillStyles({ tone: "highlight" })} style={{ width: "80%" }} />
 *   </div>
 */
export const progressTrackStyles = variants("w-full overflow-hidden rounded-full bg-primary/12", {
  variants: {
    size: { sm: "h-1", md: "h-1.5", lg: "h-2" },
  },
  defaultVariants: { size: "md" },
});

export type ProgressTrackStyleProps = VariantProps<typeof progressTrackStyles>;
export type ProgressBarSize = NonNullable<ProgressTrackStyleProps["size"]>;

/** The filled part of a continuous bar; its width is the value as a percentage (an inline style). */
export const progressFillStyles = variants("h-full rounded-full", {
  variants: {
    tone: { highlight: "bg-highlight", brand: "bg-brand" },
  },
  defaultVariants: { tone: "highlight" },
});

export type ProgressFillStyleProps = VariantProps<typeof progressFillStyles>;
export type ProgressBarTone = NonNullable<ProgressFillStyleProps["tone"]>;

/** Segmented mode (the RSVP wizard's seven steps): a row of equal pills, 4 apart. */
export const progressSegmentsStyles = "flex w-full flex-row gap-1";

/** One segment of a segmented bar: filled in the tone, otherwise the pearl 12% track. */
export const progressSegmentStyles = variants("flex-1 rounded-full", {
  variants: {
    size: { sm: "h-1", md: "h-1.5", lg: "h-2" },
    tone: { highlight: "", brand: "" },
    filled: { true: "", false: "bg-primary/12" },
  },
  compoundVariants: [
    { filled: true, tone: "highlight", class: "bg-highlight" },
    { filled: true, tone: "brand", class: "bg-brand" },
  ],
  defaultVariants: { size: "md", tone: "highlight", filled: false },
});
