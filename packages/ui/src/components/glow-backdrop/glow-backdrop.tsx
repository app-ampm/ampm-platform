import { useCallback, useId, useState } from "react";
import { View, type LayoutChangeEvent, type ViewProps } from "react-native";
import { Circle, Defs, RadialGradient, Stop, Svg } from "react-native-svg";

import { glow, type GlowTone } from "@ampm/tokens";

import { cn } from "../../lib/cn";
import {
  glowBackdropStyles,
  glowStops,
  orbCircles,
  type GlowVariant,
} from "./glow-backdrop.styles";

export interface GlowBackdropProps extends Omit<ViewProps, "children" | "pointerEvents"> {
  /** corners (default): peacock top-left, gold bottom-right · top: hero layouts · center · none. */
  readonly variant?: GlowVariant | undefined;
  readonly className?: string;
  readonly testID?: string | undefined;
}

interface Size {
  readonly width: number;
  readonly height: number;
}

const TONES: readonly GlowTone[] = ["peacock", "gold"];

function useMeasuredSize(onLayout: ViewProps["onLayout"]) {
  const [size, setSize] = useState<Size | null>(null);
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      setSize((current) =>
        current?.width === width && current.height === height ? current : { width, height },
      );
      onLayout?.(event);
    },
    [onLayout],
  );
  return { size, handleLayout };
}

function GlowGradient({ id, tone }: { readonly id: string; readonly tone: GlowTone }) {
  return (
    <RadialGradient id={id} cx="50%" cy="50%" r="50%">
      {glowStops(tone).map((stop) => (
        <Stop
          key={stop.offset}
          offset={stop.offset}
          stopColor={glow[tone].color}
          stopOpacity={stop.opacity}
        />
      ))}
    </RadialGradient>
  );
}

interface OrbsProps {
  readonly variant: GlowVariant;
  readonly size: Size;
  readonly gradientId: (tone: GlowTone) => string;
}

function Orbs({ variant, size, gradientId }: OrbsProps) {
  return (
    <Svg width={size.width} height={size.height}>
      <Defs>
        {TONES.map((tone) => (
          <GlowGradient key={tone} id={gradientId(tone)} tone={tone} />
        ))}
      </Defs>
      {orbCircles(variant, size.width, size.height).map((orb) => (
        <Circle
          key={orb.tone}
          cx={orb.cx}
          cy={orb.cy}
          r={orb.r}
          fill={`url(#${gradientId(orb.tone)})`}
        />
      ))}
    </Svg>
  );
}

/**
 * The glow orbs behind every screen: radial gradients of peacock at 55% and gold at 30% that fade to
 * nothing at 66% of their radius (`glow` in @ampm/tokens), sized to the measured container. It fills
 * its parent, never takes a touch or a scroll, and is hidden from screen readers. Each instance names
 * its own gradients, so several backdrops on one web page do not clash. `Screen` draws one already;
 * use it directly behind a hero or a full-bleed panel.
 *
 *   <View className="relative overflow-hidden rounded-2xl">
 *     <GlowBackdrop variant="top" />
 *     <Text variant="display">Weddings, planned end to end.</Text>
 *   </View>
 */
export function GlowBackdrop({
  variant = "corners",
  className,
  onLayout,
  ...rest
}: GlowBackdropProps) {
  // useId returns characters a url(#…) reference cannot carry; keep the letters and digits.
  const baseId = `glow-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const { size, handleLayout } = useMeasuredSize(onLayout);
  if (variant === "none") return null;
  return (
    // Absolute: the backdrop is a layer under the content, filling its parent from edge to edge.
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      className={cn(glowBackdropStyles(), className)}
      onLayout={handleLayout}
      {...rest}
    >
      {size && size.width > 0 && size.height > 0 ? (
        <Orbs variant={variant} size={size} gradientId={(tone) => `${baseId}-${tone}`} />
      ) : null}
    </View>
  );
}
