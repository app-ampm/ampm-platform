import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

/**
 * Whether a native glass panel may blur its backdrop. iOS only: Android draws the opaque fallback (its
 * blur is costly and experimental), and so does iOS when the person turns on Reduce Transparency.
 */
export function useGlassBlur(): boolean {
  const supported = Platform.OS === "ios";
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (!supported) return;
    let active = true;
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((value) => {
        if (active) setReduced(value);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReduced,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, [supported]);
  return supported && !reduced;
}
