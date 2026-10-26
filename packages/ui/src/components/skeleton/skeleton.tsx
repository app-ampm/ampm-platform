import { useEffect, useRef } from "react";
import { Animated, type ViewProps } from "react-native";

import { motionMs } from "@ampm/tokens";

import { useReducedMotion } from "../../hooks/use-reduced-motion";
import { cn } from "../../lib/cn";

export interface SkeletonProps extends ViewProps {
  readonly shape?: "rect" | "circle" | "text" | undefined;
  /** Size through classes: `h-4 w-32`, `h-12 w-12`. */
  readonly className?: string;
}

const SHAPE_CLASS = { rect: "rounded-md", circle: "rounded-full", text: "h-4 rounded" } as const;

/**
 * A placeholder that pulses while content loads; still under reduced motion and hidden from screen
 * readers (the surrounding screen announces its loading state).
 */
export function Skeleton({ shape = "rect", className, style, ...rest }: SkeletonProps) {
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reducedMotion) return undefined;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: motionMs.slow * 2,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: motionMs.slow * 2,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity, reducedMotion]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={cn("bg-surface-inset", SHAPE_CLASS[shape], className)}
      style={[{ opacity }, style]}
      {...rest}
    />
  );
}
