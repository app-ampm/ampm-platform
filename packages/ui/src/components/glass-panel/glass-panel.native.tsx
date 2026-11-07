import { BlurView } from "expo-blur";
import { cssInterop } from "nativewind";
import { View } from "react-native";

import { nativeBlur } from "@ampm/tokens";

import { useGlassBlur } from "../../hooks/use-glass-blur";
import { cn } from "../../lib/cn";
import { glassRecipes } from "./glass-panel.styles";
import type { GlassPanelProps } from "./glass-panel.types";

// BlurView is a third-party component: let it take `className` like the React Native primitives do.
cssInterop(BlurView, { className: "style" });

/**
 * Peacock Night's glass panel, native: a BlurView (tint dark, intensity 40) under the recipe's fill,
 * the 1px stroke on the clipped container, and the rim as a hairline along the top edge. Where blur
 * is unavailable or unwanted (Android, reduce transparency, or a nested panel) the fill is the
 * recipe's opaque fallback for top-level panels and the flat fill for nested ones.
 */
export function GlassPanel({
  recipe = "base",
  blur = true,
  className,
  children,
  ...rest
}: GlassPanelProps) {
  const canBlur = useGlassBlur();
  const parts = glassRecipes[recipe];
  const blurs = blur && canBlur;
  const fill = blur && !canBlur ? parts.fallback : parts.fill;
  return (
    <View className={cn("overflow-hidden rounded-lg border", parts.stroke, className)} {...rest}>
      {/* Absolute: the blur, fill and rim layers sit behind the content and fill the clipped panel. */}
      {blurs ? (
        <BlurView
          tint={nativeBlur.tint}
          intensity={nativeBlur.intensity}
          className="absolute inset-0"
          pointerEvents="none"
        />
      ) : null}
      <View className={cn("absolute inset-0", fill)} pointerEvents="none" />
      <View className={cn("absolute inset-x-0 top-0 h-px", parts.rim)} pointerEvents="none" />
      {children}
    </View>
  );
}
