import { View, type ViewProps } from "react-native";

import { cn } from "../../lib/cn";
import { Text } from "../text";
import {
  avatarInitialsSize,
  avatarInitialsTone,
  avatarStyles,
  initialsOf,
  type AvatarSize,
  type AvatarTone,
} from "./avatar.styles";

export interface AvatarProps extends Omit<ViewProps, "children"> {
  /** The person's name: the circle shows its initials and screen readers read it. */
  readonly name: string;
  /** sm 32 · md 40 (default) · lg 48 · xl 56. */
  readonly size?: AvatarSize | undefined;
  /** Gold (default) or peacock fill; the initials are midnight on both. */
  readonly tone?: AvatarTone | undefined;
  /** Defaults to the name. */
  readonly accessibilityLabel?: string | undefined;
  readonly className?: string;
  readonly testID?: string | undefined;
}

/**
 * A person as initials in a gold or peacock circle (Manrope 700, 800 at the smallest size), read
 * aloud as their name. Not pressable: wrap it in a Button or a pressable Card for an action.
 *
 *   <Avatar name="Ananya Sharma" tone="highlight" />
 *   <Avatar name="Eva M." size="sm" />
 */
export function Avatar({
  name,
  size = "md",
  tone = "brand",
  accessibilityLabel,
  className,
  ...rest
}: AvatarProps) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? name}
      className={cn(avatarStyles({ size, tone }), className)}
      {...rest}
    >
      <Text
        variant="label"
        tone={avatarInitialsTone[tone]}
        weight={size === "sm" ? "extrabold" : "bold"}
        className={avatarInitialsSize[size]}
        numberOfLines={1}
        maxFontSizeMultiplier={1.3}
      >
        {initialsOf(name)}
      </Text>
    </View>
  );
}
