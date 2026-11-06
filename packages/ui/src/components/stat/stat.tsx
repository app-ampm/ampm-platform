import { View, type ViewProps } from "react-native";

import { uiCopy } from "../../copy";
import { cn } from "../../lib/cn";
import { Text } from "../text";
import {
  statStyles,
  statValueSize,
  type StatAlign,
  type StatDetailTone,
  type StatSize,
  type StatTone,
} from "./stat.styles";

export interface StatProps extends Omit<ViewProps, "children"> {
  /** The eyebrow over the number: "Live weddings", "Hotel discovery". */
  readonly label: string;
  /** The number, already formatted for the reader ("18", "₹46.8L", "8 / 10"). */
  readonly value: string | number;
  /** What the number means or until when: "days left · until 5 Dec". */
  readonly caption?: string | undefined;
  /** primary (default) for counts, brand for countdowns, highlight for done or ready totals. */
  readonly tone?: StatTone | undefined;
  /** md 44 (default) for KPI cards, lg 64 for countdowns. */
  readonly size?: StatSize | undefined;
  readonly align?: StatAlign | undefined;
  /**
   * The label and caption: muted (default) on midnight and base glass, body on peacock glass (muted is
   * under 4.5:1 there), brand on gold glass.
   */
  readonly detailTone?: StatDetailTone | undefined;
  /** Defaults to "label: value caption", read as one phrase. */
  readonly accessibilityLabel?: string | undefined;
  readonly className?: string;
  readonly testID?: string | undefined;
}

/**
 * A KPI or a countdown: eyebrow label, a big Gilda Display number and a caption. Screen readers meet
 * it as one phrase ("Live weddings: 18 3 with functions this week"), not as a heading. It draws no
 * surface of its own: put it in a Card or a GlassPanel.
 *
 *   <Stat label="Live weddings" value={18} caption="3 with functions this week" />
 *   <Stat label="Wedding" value={98} caption="days to go" tone="brand" size="lg" />
 *   <GlassPanel recipe="gold" className="p-5">
 *     <Stat label="Availability requests" value={7} caption="2 past response time" detailTone="brand" />
 *   </GlassPanel>
 *   <GlassPanel recipe="peacock" className="p-5">
 *     <Stat label="Hotel discovery" value={18} caption="days left · until 5 Dec" detailTone="body" />
 *   </GlassPanel>
 */
export function Stat({
  label,
  value,
  caption,
  tone = "primary",
  size = "md",
  align = "left",
  detailTone = "muted",
  accessibilityLabel,
  className,
  ...rest
}: StatProps) {
  const shown = String(value);
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? uiCopy.stat.summary(label, shown, caption)}
      className={cn(statStyles({ align }), className)}
      {...rest}
    >
      <Text variant="eyebrow" tone={detailTone} align={align}>
        {label}
      </Text>
      <Text variant="stat" tone={tone} align={align} className={statValueSize[size]}>
        {shown}
      </Text>
      {caption ? (
        <Text variant="caption" tone={detailTone} align={align}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}
