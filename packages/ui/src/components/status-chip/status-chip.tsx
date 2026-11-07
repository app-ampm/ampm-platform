import { View, type ViewProps } from "react-native";

import { cn } from "../../lib/cn";
import { Icon, type IconName, type IconTone } from "../icon";
import { Text } from "../text";
import {
  chipDotStyles,
  chipStyles,
  chipTextStyles,
  type ChipSize,
  type StatusTone,
} from "./status-chip.styles";

export interface StatusChipProps extends Omit<ViewProps, "children"> {
  /** Always a word, never a colour alone (wireframes: status chips carry text labels). */
  readonly label: string;
  /**
   * The treatment (docs/design/peacock-night.md §8): `success` verified or done, `info` indicative
   * or submitted, `warning` waiting on someone else, `danger` needs you, `neutral` stale or closed,
   * `brand` a highlight such as "5-star".
   */
  readonly tone?: StatusTone | undefined;
  readonly size?: ChipSize | undefined;
  /** A leading 6px dot in the label's colour: "● Verified 2 Nov". */
  readonly dot?: boolean | undefined;
  readonly icon?: IconName | undefined;
  readonly className?: string;
}

/**
 * The icon tone that matches each label (icons take their colour in JavaScript, from the tokens).
 * Neutral's pearl 62% has no opaque token; the nearest is muted, pearl 58%.
 */
const ICON_TONE: Record<StatusTone, IconTone> = {
  success: "onHighlight",
  info: "primary",
  warning: "brand",
  danger: "onBrand",
  neutral: "muted",
  brand: "primary",
};

/**
 * A status as a labelled pill. Screen readers read the label (one element, role text); the treatment
 * only underlines it.
 *
 *   <StatusChip label="Verified 2 Nov" tone="success" dot />
 *   <StatusChip label="Awaiting hotel" tone="warning" size="sm" />
 *   <StatusChip label="5-star" tone="brand" icon="star" />
 */
export function StatusChip({
  label,
  tone = "neutral",
  size = "md",
  dot = false,
  icon,
  className,
  testID,
  accessibilityLabel,
  ...rest
}: StatusChipProps) {
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? label}
      className={cn(chipStyles({ tone, size }), className)}
      testID={testID}
      {...rest}
    >
      {dot ? (
        <View className={chipDotStyles({ tone })} testID={testID ? `${testID}-dot` : undefined} />
      ) : null}
      {icon ? <Icon name={icon} size="sm" tone={ICON_TONE[tone]} /> : null}
      <Text
        variant="caption"
        weight="bold"
        tone="inherit"
        numberOfLines={1}
        className={chipTextStyles({ tone })}
      >
        {label}
      </Text>
    </View>
  );
}
