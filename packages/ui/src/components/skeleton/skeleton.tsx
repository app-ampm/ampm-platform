import { useEffect, useRef } from "react";
import { Animated, Easing, Platform, View, type ViewProps } from "react-native";

import { motionBezier, motionMs } from "@ampm/tokens";

import { useReducedMotion } from "../../hooks/use-reduced-motion";
import { AnimatedView } from "../../lib/animated-view";
import { cn } from "../../lib/cn";
import { shimmerStyles, skeletonStyles, type SkeletonShape } from "./skeleton.styles";

// react-native-web has no native animated module; the JS driver is the only one on the web.
const NATIVE_DRIVER = Platform.OS !== "web";

/** One sweep of the pulse, each way: slow enough to read as a shimmer, not a flash. */
const PULSE_MS = motionMs.slow * 2;
const PULSE_EASING = Easing.bezier(...motionBezier.standard);

export interface SkeletonProps extends ViewProps {
  /** `rect` (radius 16), `circle` (avatars) or `text` (a 16-tall pill per line). */
  readonly shape?: SkeletonShape | undefined;
  /** Size through classes: `h-4 w-32`, `h-12 w-12`, `h-28 w-full`. */
  readonly className?: string;
}

/** Loops the shimmer's opacity from 0 to 1 and back until the skeleton unmounts. */
function usePulse(): Animated.Value {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const step = (toValue: number) =>
      Animated.timing(opacity, {
        toValue,
        duration: PULSE_MS,
        easing: PULSE_EASING,
        useNativeDriver: NATIVE_DRIVER,
      });
    const pulse = Animated.loop(Animated.sequence([step(1), step(0)]));
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);
  return opacity;
}

function Shimmer({ testID }: { testID: string | undefined }) {
  const opacity = usePulse();
  return (
    <AnimatedView
      // Absolute: the shimmer lies over the placeholder and never takes layout space.
      className={shimmerStyles}
      style={{ opacity }}
      pointerEvents="none"
      testID={testID ? `${testID}-shimmer` : undefined}
    />
  );
}

/**
 * A placeholder in pearl 6% with a pearl 10% shimmer while content loads. It never changes size (the
 * caller's classes set it), stands still under reduced motion, and is hidden from screen readers (the
 * screen announces its own loading state).
 *
 *   <Skeleton shape="circle" className="h-12 w-12" />
 *   <Skeleton shape="text" className="w-40" />
 *   <Skeleton className="h-28 w-full" />
 */
export function Skeleton({ shape = "rect", className, testID, ...rest }: SkeletonProps) {
  const reducedMotion = useReducedMotion();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      className={cn(skeletonStyles({ shape }), className)}
      testID={testID}
      {...rest}
    >
      {reducedMotion ? null : <Shimmer testID={testID} />}
    </View>
  );
}
