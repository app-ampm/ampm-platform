import { useEffect, useId, useState, type ComponentRef, type Ref } from "react";
import { Animated, Easing, Platform, Pressable, View, type PressableProps } from "react-native";

import { motionBezier, motionMs } from "@ampm/tokens";

import { useReducedMotion } from "../../hooks/use-reduced-motion";
import { cn } from "../../lib/cn";
import { spacePress } from "../../lib/space-press";
import { Text } from "../text";
import {
  TOGGLE_KNOB_TRAVEL,
  toggleKnobStyles,
  toggleRowStyles,
  toggleTrackStyles,
} from "./toggle.styles";

// react-native-web has no native animated module; the JS driver is the only one on the web.
const NATIVE_DRIVER = Platform.OS !== "web";
const SLIDE_EASING = Easing.bezier(...motionBezier.standard);

export interface ToggleProps extends Omit<
  PressableProps,
  | "children"
  | "disabled"
  | "style"
  | "onPress"
  | "accessibilityRole"
  | "accessibilityState"
  | "aria-checked"
  | "aria-disabled"
> {
  readonly value: boolean;
  readonly onValueChange: (value: boolean) => void;
  /** Manrope 600 13 in pearl, before the switch. Without it, give `accessibilityLabel`. */
  readonly label?: string | undefined;
  /** A line under the label in pearl 58%; screen readers hear it after the label. */
  readonly description?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly ref?: Ref<ComponentRef<typeof Pressable>> | undefined;
  readonly className?: string;
}

/** Runs the knob from off (0) to on (1) over the fast duration; reduced motion jumps there. */
function useKnobProgress(value: boolean): Animated.Value {
  const reducedMotion = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(value ? 1 : 0));
  useEffect(() => {
    const toValue = value ? 1 : 0;
    if (reducedMotion) {
      progress.setValue(toValue);
      return undefined;
    }
    const slide = Animated.timing(progress, {
      toValue,
      duration: motionMs.fast,
      easing: SLIDE_EASING,
      useNativeDriver: NATIVE_DRIVER,
    });
    slide.start();
    return () => slide.stop();
  }, [progress, value, reducedMotion]);
  return progress;
}

interface ToggleTrackProps {
  readonly value: boolean;
  readonly disabled: boolean;
  readonly testID: string | undefined;
}

function ToggleTrack({ value, disabled, testID }: ToggleTrackProps) {
  const progress = useKnobProgress(value);
  const [travel, setTravel] = useState(TOGGLE_KNOB_TRAVEL);
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-travel, travel] });
  return (
    <View
      className={toggleTrackStyles({ on: value, disabled })}
      testID={testID ? `${testID}-track` : undefined}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setTravel((width - height) / 2);
      }}
    >
      <Animated.View
        style={{ transform: [{ translateX }] }}
        testID={testID ? `${testID}-knob` : undefined}
      >
        <View className={toggleKnobStyles({ on: value })} />
      </Animated.View>
    </View>
  );
}

interface ToggleTextProps {
  readonly label: string | undefined;
  readonly description: string | undefined;
  readonly descriptionId: string;
  readonly disabled: boolean;
}

function ToggleText({ label, description, descriptionId, disabled }: ToggleTextProps) {
  if (!label && !description) return null;
  return (
    <View className="flex-1 gap-0.5">
      {label ? (
        <Text variant="label" tone={disabled ? "disabled" : "primary"}>
          {label}
        </Text>
      ) : null}
      {description ? (
        <Text variant="bodySmall" tone={disabled ? "disabled" : "muted"} nativeID={descriptionId}>
          {description}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * An on/off switch in Peacock Night: a 48 × 28 pill, gold with a midnight knob when on, pearl 12%
 * with a pearl 45% knob when off; the knob slides over the fast duration (it jumps under reduced
 * motion). The whole row is the target (at least 44 tall) with the label first and the switch at the
 * end, as in "Remember this device" (D1, P1); it is a switch to screen readers, with its state, and
 * shows the gold border and halo on keyboard focus on the web, where Space toggles it too.
 *
 *   <Toggle label="Remember this device" value={remember} onValueChange={setRemember} />
 *   <Toggle accessibilityLabel="Show to clients" value={isPublic} onValueChange={setPublic} />
 */
export function Toggle({
  value,
  onValueChange,
  label,
  description,
  disabled = false,
  accessibilityLabel,
  className,
  testID,
  ...rest
}: ToggleProps) {
  const descriptionId = useId();
  const toggle = () => onValueChange(!value);
  return (
    <Pressable
      accessibilityRole="switch"
      // aria-*, not accessibilityState: React Native maps them to the native state, and
      // react-native-web (which drops accessibilityState) writes them for the browser.
      aria-checked={value}
      aria-disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={description}
      {...(description ? { "aria-describedby": descriptionId } : {})}
      {...spacePress(disabled ? undefined : toggle)}
      disabled={disabled}
      onPress={toggle}
      className={cn(toggleRowStyles({ disabled }), className)}
      testID={testID}
      {...rest}
    >
      <ToggleText
        label={label}
        description={description}
        descriptionId={descriptionId}
        disabled={disabled}
      />
      <ToggleTrack value={value} disabled={disabled} testID={testID} />
    </Pressable>
  );
}
