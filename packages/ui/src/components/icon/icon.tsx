import { View } from "react-native";

import { colors, type ColorName } from "@ampm/tokens";

import { cn } from "../../lib/cn";
import { useTheme } from "../../theme/theme-provider";
import { icons, type IconName } from "./icon.registry";

export type IconSize = "sm" | "md" | "lg" | "xl";
export type IconTone =
  | "primary"
  | "body"
  | "muted"
  | "brand"
  | "highlight"
  | "onBrand"
  | "onHighlight"
  | "success"
  | "warning"
  | "danger"
  | "info";

export interface IconProps {
  readonly name: IconName;
  readonly size?: IconSize | undefined;
  readonly tone?: IconTone | undefined;
  /** Spoken by screen readers; without it the icon is decorative and hidden from them. */
  readonly label?: string | undefined;
  readonly className?: string | undefined;
  readonly testID?: string | undefined;
}

const SIZES: Record<IconSize, number> = { sm: 16, md: 20, lg: 24, xl: 32 };

const TONE_COLOR: Record<IconTone, ColorName> = {
  primary: "primary",
  body: "body",
  muted: "muted",
  brand: "brand",
  highlight: "highlight",
  onBrand: "brand-ink",
  onHighlight: "highlight-ink",
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
};

/**
 * The shared icon (Lucide through react-native-svg, identical on every platform). Colour comes from
 * the tokens for the current scheme, so an icon never carries a hex of its own: pearl, gold or peacock
 * (Peacock Night), or midnight on a gold or peacock fill.
 *
 *   <Icon name="check-circle" tone="success" label="Verified" />
 */
export function Icon({ name, size = "md", tone = "primary", label, className, testID }: IconProps) {
  const { resolved } = useTheme();
  const Glyph = icons[name];
  const pixels = SIZES[size];
  const accessibility = label
    ? { accessible: true, accessibilityRole: "image" as const, accessibilityLabel: label }
    : {
        accessibilityElementsHidden: true,
        importantForAccessibility: "no-hide-descendants" as const,
      };
  return (
    <View
      className={cn("items-center justify-center", className)}
      testID={testID}
      {...accessibility}
    >
      <Glyph size={pixels} color={colors[TONE_COLOR[tone]][resolved]} strokeWidth={2} />
    </View>
  );
}
