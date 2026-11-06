import { View, type ViewProps } from "react-native";

import { uiCopy } from "../../copy";
import { cn } from "../../lib/cn";
import { Text } from "../text";
import { badgeLabelStyles, badgeStyles, type BadgeTone } from "./badge.styles";

export interface BadgeProps extends Omit<ViewProps, "children"> {
  /** The number to show. Nothing renders for 0 (or less) unless `label` is given. */
  readonly count?: number | undefined;
  /** A word shown instead of the number ("New"). */
  readonly label?: string | undefined;
  /** Gold for needs-you counts (the default); peacock for a highlight. */
  readonly tone?: BadgeTone | undefined;
  /** Counts above it show as "99+" and are read as "More than 99". Defaults to 99. */
  readonly max?: number | undefined;
  /** What screen readers say; defaults to the number, or "More than 99" when capped. */
  readonly accessibilityLabel?: string | undefined;
  readonly className?: string;
  readonly testID?: string | undefined;
}

interface BadgeContent {
  readonly shown: string;
  readonly spoken: string;
}

/** The label wins; then the whole count, capped at `max`; nothing for an empty count. */
function badgeContent(
  count: number | undefined,
  label: string | undefined,
  max: number,
): BadgeContent | null {
  if (label) return { shown: label, spoken: label };
  const whole = Math.floor(count ?? 0);
  if (!Number.isFinite(whole) || whole <= 0) return null;
  if (whole > max)
    return { shown: uiCopy.badge.capped(max), spoken: uiCopy.badge.cappedSpoken(max) };
  return { shown: String(whole), spoken: String(whole) };
}

/**
 * The count badge of the tab bar and the rail ("Approvals 2"): gold with midnight numerals, or
 * peacock with `tone="highlight"`. Renders nothing for a zero count, so callers pass the count as is.
 * Where the spoken form differs from what is drawn ("99+", read as "More than 99"), the web gets it as
 * visually hidden text and the drawn one is hidden: react-native-web renders the badge as a plain
 * element, whose label screen readers do not read. Native reads the badge's accessibilityLabel.
 *
 *   <Row gap={2}><Text variant="label">Approvals</Text><Badge count={pending} /></Row>
 *   <Badge count={128} />            // 99+, read as "More than 99"
 *   <Badge label="New" tone="highlight" />
 */
export function Badge({
  count,
  label,
  tone = "brand",
  max = 99,
  accessibilityLabel,
  className,
  testID,
  ...rest
}: BadgeProps) {
  const content = badgeContent(count, label, max);
  if (!content) return null;
  const spoken = accessibilityLabel ?? content.spoken;
  const hasSpokenForm = spoken !== content.shown;
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={spoken}
      className={cn(badgeStyles({ tone }), className)}
      testID={testID}
      {...rest}
    >
      {/* The data variant keeps tabular numerals on native, where the class alone is dropped. */}
      <Text
        variant="data"
        tone="inherit"
        numberOfLines={1}
        className={badgeLabelStyles({ tone })}
        {...(hasSpokenForm ? { "aria-hidden": true } : {})}
      >
        {content.shown}
      </Text>
      {hasSpokenForm ? <Text className="native:hidden web:sr-only">{spoken}</Text> : null}
    </View>
  );
}
