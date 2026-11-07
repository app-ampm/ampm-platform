import { useEffect, useRef, type ComponentRef, type RefObject } from "react";
import { ScrollView, View, type LayoutChangeEvent, type ViewProps } from "react-native";

import { useReducedMotion } from "../../hooks/use-reduced-motion";
import { useTabIndicator, type TabIndicator } from "../../hooks/use-tab-indicator";
import { AnimatedView } from "../../lib/animated-view";
import { cn } from "../../lib/cn";
import { Segment } from "./segment";
import {
  segmentIndicatorStyles,
  segmentedRowStyles,
  segmentedScrollContentStyles,
  segmentedScrollStyles,
  segmentedTrackStyles,
  type SegmentedControlSize,
} from "./segmented-control.styles";

export interface SegmentedControlOption {
  /** Unique within the control; reported by `onChange`. */
  readonly value: string;
  readonly label: string;
  /** A count after the label: "Waiting · 4". */
  readonly badge?: number | string | undefined;
  readonly disabled?: boolean | undefined;
}

export interface SegmentedControlProps extends Omit<ViewProps, "children"> {
  readonly options: ReadonlyArray<SegmentedControlOption>;
  /** The selected option's value. */
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** `sm` tightens the padding; both keep a 44px target. */
  readonly size?: SegmentedControlSize | undefined;
  /** Scrolls sideways inside a full-width track when the segments do not fit (the hotel page tabs). */
  readonly scrollable?: boolean | undefined;
  /** Spans the width and shares it equally between the segments (W6, P7). */
  readonly fullWidth?: boolean | undefined;
  /** Names the group for screen readers ("Hotel sections"). */
  readonly accessibilityLabel: string;
  readonly className?: string;
}

export interface SegmentFrame {
  readonly x: number;
  readonly width: number;
}

/**
 * The scroll offset that centres a segment in a strip `viewport` wide, or null before both are laid
 * out. Never negative; the scroll views clamp an offset past the far end themselves.
 */
export function centredScrollX(frame: SegmentFrame | undefined, viewport: number): number | null {
  if (!frame || viewport <= 0) return null;
  return Math.max(0, frame.x + frame.width / 2 - viewport / 2);
}

type ScrollRef = RefObject<ComponentRef<typeof ScrollView> | null>;

function centreOn(
  scroll: ScrollRef,
  frame: SegmentFrame | undefined,
  viewport: number,
  animated: boolean,
) {
  const x = centredScrollX(frame, viewport);
  if (x !== null) scroll.current?.scrollTo({ x, animated });
}

/**
 * Keeps the selected segment of a scrollable strip in view: centred once laid out (a screen opened on
 * "Rates"), and slid to the centre when the selection changes; reduced motion jumps.
 */
function useCentredSelection(value: string) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const frames = useRef(new Map<string, SegmentFrame>());
  const viewport = useRef(0);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    centreOn(scroll, frames.current.get(value), viewport.current, !reducedMotion);
  }, [value, reducedMotion]);
  const onViewportLayout = (event: LayoutChangeEvent) => {
    viewport.current = event.nativeEvent.layout.width;
    centreOn(scroll, frames.current.get(value), viewport.current, false);
  };
  const onSegmentLayout = (segment: string, event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    frames.current.set(segment, { x, width });
    if (segment === value) centreOn(scroll, { x, width }, viewport.current, false);
  };
  return { scroll, onViewportLayout, onSegmentLayout };
}

interface TrackProps extends Omit<SegmentedControlProps, "size" | "scrollable" | "fullWidth"> {
  readonly size: SegmentedControlSize;
  readonly fullWidth: boolean;
}

interface SegmentRowProps extends Pick<
  TrackProps,
  "options" | "value" | "onChange" | "size" | "fullWidth" | "testID"
> {
  readonly onSegmentLayout?: ((segment: string, event: LayoutChangeEvent) => void) | undefined;
}

function SegmentIndicator({ indicator, testID }: { indicator: TabIndicator; testID?: string }) {
  return (
    <AnimatedView
      pointerEvents="none"
      className={segmentIndicatorStyles}
      // Measured width and an animated offset: both are run-time numbers.
      style={{ width: indicator.width, transform: [{ translateX: indicator.translateX }] }}
      testID={testID}
    />
  );
}

/** The segments, and the peacock pill that slides behind the selected one, measured in one row. */
function SegmentRow({ options, value, onSegmentLayout, testID, ...shared }: SegmentRowProps) {
  const indicator = useTabIndicator(value);
  return (
    <View className={segmentedRowStyles}>
      {indicator.ready ? (
        <SegmentIndicator
          indicator={indicator}
          {...(testID ? { testID: `${testID}-indicator` } : {})}
        />
      ) : null}
      {options.map((option) => (
        <Segment
          key={option.value}
          {...shared}
          option={option}
          selected={option.value === value}
          indicator={indicator.ready}
          onLayout={(event) => {
            indicator.onTabLayout(option.value, event);
            onSegmentLayout?.(option.value, event);
          }}
          testID={testID ? `${testID}-${option.value}` : undefined}
        />
      ))}
    </View>
  );
}

function StaticTrack({
  options,
  value,
  onChange,
  size,
  fullWidth,
  className,
  testID,
  ...rest
}: TrackProps) {
  return (
    <View
      accessibilityRole="tablist"
      className={cn(segmentedTrackStyles({ fullWidth }), className)}
      testID={testID}
      {...rest}
    >
      <SegmentRow {...{ options, value, onChange, size, fullWidth, testID }} />
    </View>
  );
}

function ScrollTrack({
  options,
  value,
  onChange,
  size,
  className,
  testID,
  onLayout,
  ...rest
}: TrackProps) {
  const centred = useCentredSelection(value);
  return (
    <ScrollView
      ref={centred.scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      className={cn(segmentedScrollStyles, className)}
      contentContainerClassName={segmentedScrollContentStyles({ size })}
      testID={testID}
      onLayout={(event) => {
        centred.onViewportLayout(event);
        onLayout?.(event);
      }}
      {...rest}
    >
      <SegmentRow
        {...{ options, value, onChange, size, testID }}
        fullWidth={false}
        onSegmentLayout={centred.onSegmentLayout}
      />
    </ScrollView>
  );
}

/**
 * Peacock Night's segmented control and tab strip: a midnight pill track with a pearl 16% stroke, the
 * selected segment on a peacock pill with a midnight label that slides to the next selection (it jumps
 * under reduced motion), the others pearl 80% with a pearl 8% hover. `fullWidth` shares the width
 * equally (the enquiry / demo switch, Waiting / Decided); `scrollable` lets a long strip scroll inside
 * the track and keeps the selected tab centred (Overview, Rooms, Venues, Rates, Menus, Location).
 * Screen readers hear a tab list of tabs with their selected state; every segment has a 44px target,
 * takes Space and Enter on the web, and shows the gold border and halo on keyboard focus.
 *
 *   <SegmentedControl
 *     accessibilityLabel="Approvals"
 *     fullWidth
 *     options={[{ value: "waiting", label: "Waiting", badge: 4 }, { value: "decided", label: "Decided", badge: 11 }]}
 *     value={tab}
 *     onChange={setTab}
 *   />
 */
export function SegmentedControl({
  size = "md",
  scrollable = false,
  fullWidth = false,
  ...track
}: SegmentedControlProps) {
  return scrollable ? (
    <ScrollTrack {...track} size={size} fullWidth={false} />
  ) : (
    <StaticTrack {...track} size={size} fullWidth={fullWidth} />
  );
}
