import { View } from "react-native";

import { cn } from "../../lib/cn";
import { Icon, type IconName } from "../icon";
import { Text } from "../text";
import { chipStyles, chipTextTone, type ChipSize, type StatusTone } from "./status-chip.styles";

export interface StatusChipProps {
  /** Always a word, never a colour alone (wireframes: status chips carry text labels). */
  readonly label: string;
  readonly tone?: StatusTone | undefined;
  readonly size?: ChipSize | undefined;
  readonly icon?: IconName | undefined;
  readonly className?: string | undefined;
  readonly testID?: string | undefined;
  readonly accessibilityLabel?: string | undefined;
}

/**
 * A status as a labelled pill: `<StatusChip label="Verified" tone="success" icon="check" />`.
 * The label text is read by screen readers; the tone only underlines it.
 */
export function StatusChip({
  label,
  tone = "neutral",
  size = "md",
  icon,
  className,
  testID,
  accessibilityLabel,
}: StatusChipProps) {
  const textTone = chipTextTone[tone];
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? label}
      className={cn(chipStyles({ tone, size }), className)}
      testID={testID}
    >
      {icon ? <Icon name={icon} size="sm" tone={textTone} /> : null}
      <Text
        variant={size === "sm" ? "caption" : "label"}
        tone={textTone}
        weight="medium"
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}
