import { Pressable, View, type ViewProps } from "react-native";

import { cn } from "../../lib/cn";
import { cardStyles, type CardPadding } from "./card.styles";

export interface CardProps extends ViewProps {
  readonly padding?: CardPadding | undefined;
  readonly elevated?: boolean | undefined;
  /** Makes the whole card a button; give `accessibilityLabel` when the content is not a sentence. */
  readonly onPress?: (() => void) | undefined;
  readonly className?: string;
}

/**
 * The raised surface: a record in a list, a section on a screen. With `onPress` it becomes a
 * button with pressed, hover and focus states.
 */
export function Card({
  padding = "md",
  elevated = false,
  onPress,
  className,
  accessibilityLabel,
  ...rest
}: CardProps) {
  const classes = cn(cardStyles({ padding, elevated, pressable: Boolean(onPress) }), className);
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        {...(accessibilityLabel ? { accessibilityLabel } : {})}
        onPress={onPress}
        className={classes}
        {...rest}
      />
    );
  }
  return (
    <View className={classes} {...(accessibilityLabel ? { accessibilityLabel } : {})} {...rest} />
  );
}
