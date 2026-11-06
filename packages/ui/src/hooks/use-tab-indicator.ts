import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, type LayoutChangeEvent } from "react-native";

import { motionBezier, motionMs } from "@ampm/tokens";

import { useReducedMotion } from "./use-reduced-motion";

// react-native-web has no native animated module; the JS driver is the only one on the web.
const NATIVE_DRIVER = Platform.OS !== "web";
const EASE = Easing.bezier(...motionBezier.standard);

interface Slot {
  readonly x: number;
  readonly width: number;
}

export interface TabIndicator {
  /** True once the active tab is measured and the pill sits on it; until then the tab fills itself. */
  readonly ready: boolean;
  /** The pill's offset from the start of the row. */
  readonly translateX: Animated.Value;
  /** The active tab's measured width. */
  readonly width: number;
  /** Every tab reports its layout here. */
  readonly onTabLayout: (key: string, event: LayoutChangeEvent) => void;
}

/**
 * The sliding peacock pill behind the active tab or segment ("tabs and segments slide their pill":
 * TabBar, SegmentedControl). The tabs report their positions; the pill jumps to the first active tab
 * and slides (200 ms, standard ease) to each next one, or jumps every time under reduced motion.
 * Nothing is measured on the server or before the first layout, so the active tab paints its own pill
 * until `ready`, and the markup never depends on layout.
 */
export function useTabIndicator(activeKey: string): TabIndicator {
  const reducedMotion = useReducedMotion();
  const translateX = useRef(new Animated.Value(0)).current;
  const [slots, setSlots] = useState<Readonly<Record<string, Slot>>>({});
  const [isPlaced, setPlaced] = useState(false);
  const slot = slots[activeKey];
  const target = slot?.x;

  useEffect(() => {
    if (target === undefined) return undefined;
    if (!isPlaced || reducedMotion) {
      translateX.setValue(target);
      setPlaced(true);
      return undefined;
    }
    const slide = Animated.timing(translateX, {
      toValue: target,
      duration: motionMs.base,
      easing: EASE,
      useNativeDriver: NATIVE_DRIVER,
    });
    slide.start();
    return () => slide.stop();
  }, [target, isPlaced, reducedMotion, translateX]);

  const onTabLayout = useCallback((key: string, event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setSlots((previous) => {
      const known = previous[key];
      if (known && known.x === x && known.width === width) return previous;
      return { ...previous, [key]: { x, width } };
    });
  }, []);

  return {
    ready: isPlaced && slot !== undefined,
    translateX,
    width: slot?.width ?? 0,
    onTabLayout,
  };
}
