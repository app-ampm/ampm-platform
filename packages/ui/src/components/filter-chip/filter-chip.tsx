import {
  forwardRef,
  type ComponentRef,
  type ForwardRefExoticComponent,
  type RefAttributes,
} from "react";
import { Pressable, View, type PressableProps } from "react-native";

import { uiCopy } from "../../copy";
import { cn } from "../../lib/cn";
import { Icon, type IconName } from "../icon";
import { Text } from "../text";
import {
  filterChipLabelStyles,
  filterChipStyles,
  filterChipTargetStyles,
} from "./filter-chip.styles";

export interface FilterChipProps extends Omit<PressableProps, "children" | "disabled" | "style"> {
  /** The filter's name: "Heritage", "Lake view", "300+". */
  readonly label: string;
  /** Selected chips are solid peacock with a midnight label. */
  readonly selected?: boolean | undefined;
  readonly icon?: IconName | undefined;
  /** A number after the label, as in "Filters · 2". */
  readonly count?: number | undefined;
  readonly disabled?: boolean | undefined;
  readonly className?: string;
}

interface PillProps {
  readonly text: string;
  readonly icon: IconName | undefined;
  readonly selected: boolean;
  readonly disabled: boolean;
  readonly testID: string | undefined;
}

/** The visible pill and its icon and label; the pressable around it takes focus, hover and press. */
function ChipPill({ text, icon, selected, disabled, testID }: PillProps) {
  // Disabled icons match the pearl 45% label: the Icon has no 45% tone, so its box carries it.
  const iconTone = selected && !disabled ? "onHighlight" : "primary";
  return (
    <View
      className={filterChipStyles({ selected, disabled, nested: true })}
      testID={testID ? `${testID}-pill` : undefined}
    >
      {icon ? (
        <Icon
          name={icon}
          size="sm"
          tone={iconTone}
          className={disabled ? "opacity-45" : undefined}
        />
      ) : null}
      <Text
        variant="label"
        tone="inherit"
        numberOfLines={1}
        className={filterChipLabelStyles({ selected, disabled })}
      >
        {text}
      </Text>
    </View>
  );
}

/**
 * A selectable filter pill for search screens. It reads as a button with a selected state (a toggle
 * button on the web); the screen owns which filters are on. The pressable is a 46 target around the
 * 38 pill (Pressable has no hitSlop on the web), laid out as tall as the pill; a horizontal
 * ScrollView of chips clips at its edges, so give its content 4 above and below (`py-1`). States:
 * default, hover (web), pressed, focus-visible (the gold border and halo), selected, disabled.
 *
 *   <FilterChip label="Lake view" selected={lakeView} onPress={() => setLakeView(!lakeView)} />
 *   <FilterChip label="Filters" icon="sliders" count={2} onPress={openFilters} />
 */
export const FilterChip: ForwardRefExoticComponent<
  FilterChipProps & RefAttributes<ComponentRef<typeof Pressable>>
> = forwardRef<ComponentRef<typeof Pressable>, FilterChipProps>(function FilterChip(
  {
    label,
    selected = false,
    icon,
    count,
    disabled = false,
    className,
    accessibilityLabel,
    testID,
    ...rest
  },
  ref,
) {
  const withCount = count !== undefined;
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ?? (withCount ? uiCopy.filterChip.spokenWithCount(label, count) : label)
      }
      accessibilityState={{ selected, disabled }}
      // react-native-web drops accessibilityState: aria-pressed makes it a toggle in the browser.
      aria-pressed={selected}
      disabled={disabled}
      className={cn(filterChipTargetStyles({ disabled }), className)}
      testID={testID}
      {...rest}
    >
      <ChipPill
        text={withCount ? uiCopy.filterChip.withCount(label, count) : label}
        icon={icon}
        selected={selected}
        disabled={disabled}
        testID={testID}
      />
    </Pressable>
  );
});
