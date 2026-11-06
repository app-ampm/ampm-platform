import {
  forwardRef,
  type ComponentRef,
  type ForwardRefExoticComponent,
  type RefAttributes,
} from "react";
import { ActivityIndicator, Pressable, View, type PressableProps } from "react-native";

import { colors, type ColorName } from "@ampm/tokens";

import { useReducedMotion } from "../../hooks/use-reduced-motion";
import { cn } from "../../lib/cn";
import { useTheme } from "../../theme/theme-provider";
import { Icon, type IconName } from "../icon";
import { Text } from "../text";
import {
  buttonIconSize,
  buttonLabelStyles,
  buttonLabelTone,
  buttonStyles,
  type ButtonSize,
  type ButtonVariant,
} from "./button.styles";

export interface ButtonProps extends Omit<PressableProps, "children" | "disabled" | "style"> {
  /** The label. An icon-only button omits it and must give `accessibilityLabel`. */
  readonly children?: string | undefined;
  /**
   * primary (gold, one per screen), secondary (pearl outline), highlight (peacock, confirm actions),
   * glass (over photos, floating and back buttons), ghost (text only), destructive (gold outline).
   */
  readonly variant?: ButtonVariant | undefined;
  readonly size?: ButtonSize | undefined;
  readonly icon?: IconName | undefined;
  readonly iconEnd?: IconName | undefined;
  readonly loading?: boolean | undefined;
  readonly disabled?: boolean | undefined;
  readonly fullWidth?: boolean | undefined;
  readonly className?: string;
}

/** The busy indicator takes the label's ink so it reads on every fill. */
const INDICATOR_COLOR: Record<ButtonVariant, ColorName> = {
  primary: "brand-ink",
  secondary: "primary",
  highlight: "highlight-ink",
  glass: "primary",
  ghost: "primary",
  destructive: "brand",
};

interface ContentProps {
  readonly children: string | undefined;
  readonly icon: IconName | undefined;
  readonly iconEnd: IconName | undefined;
  readonly variant: ButtonVariant;
  readonly size: ButtonSize;
  readonly disabled: boolean;
  readonly hidden: boolean;
}

function ButtonContent({ children, icon, iconEnd, variant, size, disabled, hidden }: ContentProps) {
  const iconSize = buttonIconSize(size, !children);
  // Disabled icons match the pearl 45% label: the Icon has no 45% tone, so its box carries it.
  const tone = disabled ? "primary" : buttonLabelTone[variant];
  const iconClass = disabled ? "opacity-45" : undefined;
  return (
    <View className={cn("flex-row items-center gap-2", hidden && "opacity-0")}>
      {icon ? <Icon name={icon} size={iconSize} tone={tone} className={iconClass} /> : null}
      {children ? (
        <Text
          variant="label"
          tone="inherit"
          numberOfLines={1}
          className={buttonLabelStyles({ variant, size, disabled })}
        >
          {children}
        </Text>
      ) : null}
      {iconEnd ? <Icon name={iconEnd} size={iconSize} tone={tone} className={iconClass} /> : null}
    </View>
  );
}

/** A spinner over the invisible label; with reduced motion, a still ellipsis instead. */
function BusyIndicator({ variant }: { readonly variant: ButtonVariant }) {
  const { resolved } = useTheme();
  const reducedMotion = useReducedMotion();
  return (
    // Absolute: the indicator sits over the invisible label so the button keeps its size while busy.
    <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
      {reducedMotion ? (
        <Icon name="more" tone={buttonLabelTone[variant]} testID="button-spinner-still" />
      ) : (
        <ActivityIndicator
          color={colors[INDICATOR_COLOR[variant]][resolved]}
          testID="button-spinner"
        />
      )}
    </View>
  );
}

/**
 * The one button: a Peacock Night pill. States: default, hover (web), pressed, focus-visible (web,
 * the gold border and halo), disabled (dashed, pearl 45%), loading (keeps its size, announces busy).
 * An icon without a label is a circle and needs `accessibilityLabel`.
 *
 *   <Button onPress={requestDemo}>Request a demo</Button>
 *   <Button variant="highlight" onPress={approve}>Approve version 3</Button>
 *   <Button variant="secondary" size="sm" iconEnd="arrow-right">Choose</Button>
 *   <Button variant="glass" icon="heart" accessibilityLabel="Save hotel" onPress={save} />
 */
export const Button: ForwardRefExoticComponent<
  ButtonProps & RefAttributes<ComponentRef<typeof Pressable>>
> = forwardRef<ComponentRef<typeof Pressable>, ButtonProps>(function Button(
  {
    children,
    variant = "primary",
    size = "md",
    icon,
    iconEnd,
    loading = false,
    disabled = false,
    fullWidth = false,
    className,
    accessibilityLabel,
    ...rest
  },
  ref,
) {
  const inactive = disabled || loading;
  const look = { variant, size, disabled };
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? children}
      accessibilityState={{ disabled: inactive, busy: loading }}
      // react-native-web reads aria-*, not accessibilityState: the busy state reaches the browser too.
      aria-busy={loading}
      disabled={inactive}
      className={cn(buttonStyles({ ...look, fullWidth, iconOnly: !children }), className)}
      {...rest}
    >
      <ButtonContent {...look} icon={icon} iconEnd={iconEnd} hidden={loading}>
        {children}
      </ButtonContent>
      {loading ? <BusyIndicator variant={variant} /> : null}
    </Pressable>
  );
});
