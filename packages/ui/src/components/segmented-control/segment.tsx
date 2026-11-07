import { Pressable, View, type LayoutChangeEvent } from "react-native";

import { uiCopy } from "../../copy";
import { spacePress } from "../../lib/space-press";
import { Text } from "../text";
import type { SegmentedControlOption } from "./segmented-control";
import {
  segmentLabelStyles,
  segmentStyles,
  segmentTargetStyles,
  type SegmentedControlSize,
} from "./segmented-control.styles";

export interface SegmentProps {
  readonly option: SegmentedControlOption;
  readonly selected: boolean;
  /** True once the sliding pill paints the selected segment; until then the segment paints itself. */
  readonly indicator: boolean;
  readonly size: SegmentedControlSize;
  readonly fullWidth: boolean;
  readonly onChange: (value: string) => void;
  readonly onLayout: (event: LayoutChangeEvent) => void;
  readonly testID: string | undefined;
}

type PillProps = Pick<SegmentProps, "option" | "selected" | "indicator" | "size" | "testID">;

/** The visible pill and its label; the pressable around it takes focus, hover and press. */
function SegmentPill({ option, selected, indicator, size, testID }: PillProps) {
  const disabled = option.disabled === true;
  const { label, badge } = option;
  return (
    <View
      className={segmentStyles({ size, selected, indicator, disabled, nested: true })}
      testID={testID ? `${testID}-pill` : undefined}
    >
      <Text
        variant="label"
        tone="inherit"
        numberOfLines={1}
        className={segmentLabelStyles({
          state: selected ? "selected" : disabled ? "disabled" : "default",
        })}
      >
        {badge === undefined ? label : uiCopy.segmentedControl.withBadge(label, badge)}
      </Text>
    </View>
  );
}

/**
 * One segment: a tab with its selected state, a 44px target around the visible pill, and Space as well
 * as Enter on the web. aria-selected and aria-disabled rather than accessibilityState: React Native maps
 * them to the native state, and react-native-web (which drops accessibilityState) writes them for the
 * browser. Internal to the SegmentedControl.
 */
export function Segment({ option, size, fullWidth, onChange, onLayout, ...pill }: SegmentProps) {
  const disabled = option.disabled === true;
  const { label, badge } = option;
  const select = () => {
    if (!pill.selected) onChange(option.value);
  };
  return (
    <Pressable
      accessibilityRole="tab"
      aria-selected={pill.selected}
      aria-disabled={disabled}
      accessibilityLabel={
        badge === undefined ? label : uiCopy.segmentedControl.spokenWithBadge(label, badge)
      }
      {...spacePress(disabled ? undefined : select)}
      disabled={disabled}
      onPress={select}
      onLayout={onLayout}
      className={segmentTargetStyles({ size, disabled, fullWidth })}
      testID={pill.testID}
    >
      <SegmentPill option={option} size={size} {...pill} />
    </Pressable>
  );
}
