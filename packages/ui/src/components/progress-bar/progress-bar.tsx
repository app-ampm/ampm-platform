import { View, type ViewProps } from "react-native";

import { uiCopy } from "../../copy";
import { cn } from "../../lib/cn";
import {
  progressFillStyles,
  progressSegmentStyles,
  progressSegmentsStyles,
  progressTrackStyles,
  type ProgressBarSize,
  type ProgressBarTone,
} from "./progress-bar.styles";

export interface ProgressBarProps extends Omit<ViewProps, "children"> {
  /** How far along, from 0 to 1. Values outside are clamped; anything not a number counts as 0. */
  readonly value: number;
  /** Track height: `sm` 4, `md` 6, `lg` 8. */
  readonly size?: ProgressBarSize | undefined;
  /**
   * Segmented mode: that many pills, the first `Math.round(value * steps)` filled (the RSVP wizard's
   * seven steps). Leave it out for a continuous bar.
   */
  readonly steps?: number | undefined;
  /** Peacock (`highlight`) for progress; gold (`brand`) only for a countdown or something that needs the person. */
  readonly tone?: ProgressBarTone | undefined;
  /** What the bar measures, for screen readers ("Readiness, Sangeet"). Defaults to "Progress". */
  readonly label?: string | undefined;
  /** Spoken instead of the percentage; segmented bars say "3 of 7" unless this is given. */
  readonly valueText?: string | undefined;
  readonly className?: string;
}

/** The value as a fraction in 0..1, whatever the caller passed. */
export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** The number of pills a segmented bar draws (0 means continuous). */
function segmentCount(steps: number | undefined): number {
  if (steps === undefined || !Number.isFinite(steps)) return 0;
  return Math.max(0, Math.floor(steps));
}

interface ProgressReading {
  /** Pills to draw; 0 for a continuous bar. */
  readonly count: number;
  /** Pills filled. */
  readonly filled: number;
  /** What the bar shows, in percent (the filled pills' share in segmented mode). */
  readonly percent: number;
  /** Spoken instead of the percentage, if anything. */
  readonly spoken: string | undefined;
}

function readProgress(value: number, steps: number | undefined, valueText: string | undefined) {
  const fraction = clampProgress(value);
  const count = segmentCount(steps);
  const filled = Math.round(fraction * count);
  const reading: ProgressReading = {
    count,
    filled,
    percent: count > 0 ? Math.round((filled / count) * 100) : Math.round(fraction * 100),
    spoken: valueText ?? (count > 0 ? uiCopy.progress.steps(filled, count) : undefined),
  };
  return reading;
}

interface BarPartsProps {
  readonly reading: ProgressReading;
  readonly size: ProgressBarSize;
  readonly tone: ProgressBarTone;
  readonly testID: string | undefined;
}

/** The fill of a continuous bar, or the pills of a segmented one. */
function BarParts({ reading, size, tone, testID }: BarPartsProps) {
  if (reading.count === 0) {
    return (
      <View
        className={progressFillStyles({ tone })}
        // The fill's width is the value itself: a percentage computed from the prop.
        style={{ width: `${reading.percent}%` }}
        testID={testID ? `${testID}-fill` : undefined}
      />
    );
  }
  return (
    <>
      {Array.from({ length: reading.count }, (_, index) => (
        <View
          key={index}
          className={progressSegmentStyles({ size, tone, filled: index < reading.filled })}
          testID={testID ? `${testID}-segment-${index}` : undefined}
        />
      ))}
    </>
  );
}

/**
 * A pill progress bar: pearl 12% track, peacock fill. Continuous by default (readiness "8 / 10", the
 * days-left meter); `steps` draws the segmented bar of a wizard. The visible heading and count are the
 * caller's (a Text above it); the bar itself reads as a progress bar with its percentage. The value
 * is aria-valuenow (and aria-valuetext): React Native maps it to the native value, and
 * react-native-web, which drops accessibilityValue, writes it for the browser.
 *
 *   <ProgressBar value={0.8} size="lg" label="Readiness, Sangeet" />
 *   <ProgressBar value={3 / 7} steps={7} size="sm" label="RSVP" />
 *   <ProgressBar value={daysLeft / 30} tone="brand" label="Days left" />
 */
export function ProgressBar({
  value,
  size = "md",
  steps,
  tone = "highlight",
  label = uiCopy.progress.label,
  valueText,
  className,
  testID,
  ...rest
}: ProgressBarProps) {
  const reading = readProgress(value, steps, valueText);
  const { percent, spoken } = reading;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      {...(spoken ? { "aria-valuetext": spoken } : {})}
      className={cn(
        reading.count > 0 ? progressSegmentsStyles : progressTrackStyles({ size }),
        className,
      )}
      testID={testID}
      {...rest}
    >
      <BarParts reading={reading} size={size} tone={tone} testID={testID} />
    </View>
  );
}
