import {
  forwardRef,
  type ComponentRef,
  type ForwardRefExoticComponent,
  type RefAttributes,
} from "react";
import { Pressable, type PressableProps } from "react-native";

import { cn } from "../../lib/cn";
import { focusRingStyles } from "../glass-panel";
import { Icon } from "../icon";
import { Text } from "../text";

export interface TextActionProps extends Omit<PressableProps, "children" | "style" | "disabled"> {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean | undefined;
  readonly className?: string;
}

/**
 * The gold text action of a notice (Callout, Toast, OfflineBanner): Manrope 700 with an arrow, like the
 * standalone Link but for a callback. The target is 44px tall while the row only takes its line's
 * height (the negative margins), so a notice stays as compact as its text. Hover dims it on the web,
 * pressing dims it further, and keyboard focus shows the gold border and halo (the 1px stroke is
 * transparent until then, so focus never moves the text).
 *
 *   <TextAction label="Retry now" onPress={retry} />
 */
export const TextAction: ForwardRefExoticComponent<
  TextActionProps & RefAttributes<ComponentRef<typeof Pressable>>
> = forwardRef<ComponentRef<typeof Pressable>, TextActionProps>(function TextAction(
  { label, onPress, disabled = false, className, accessibilityLabel, ...rest },
  ref,
) {
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        "-my-3 min-h-touch min-w-touch flex-row items-center gap-1 self-start rounded-full",
        "border border-transparent",
        "web:transition-opacity web:duration-fast web:motion-reduce:transition-none",
        !disabled && "active:opacity-70 web:hover:opacity-80",
        focusRingStyles,
        className,
      )}
      {...rest}
    >
      <Text variant="label" weight="bold" tone={disabled ? "disabled" : "brand"}>
        {label}
      </Text>
      <Icon name="arrow-right" size="sm" tone={disabled ? "muted" : "brand"} />
    </Pressable>
  );
});
