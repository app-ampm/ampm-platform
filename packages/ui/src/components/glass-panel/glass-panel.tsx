import { View } from "react-native";

import { cn } from "../../lib/cn";
import { glassStyles } from "./glass-panel.styles";
import type { GlassPanelProps } from "./glass-panel.types";

/**
 * Peacock Night's glass panel, web: one element with the recipe's fill, stroke and rim, and a backdrop
 * blur of 24 with saturate 150% when it is a top-level panel. Native draws the same panel with an
 * expo-blur BlurView (glass-panel.native.tsx).
 *
 *   <GlassPanel className="gap-3 p-5">…</GlassPanel>
 *   <GlassPanel recipe="peacock" className="rounded-full px-4 py-3">…</GlassPanel>
 */
export function GlassPanel({ recipe = "base", blur = true, className, ...rest }: GlassPanelProps) {
  return <View className={cn("rounded-lg", glassStyles({ recipe, blur }), className)} {...rest} />;
}
