import { ActivityIndicator, Pressable, View, type PressableProps } from "react-native";

import { colors } from "@ampm/tokens";

import { cn } from "../../lib/cn";
import { useTheme } from "../../theme/theme-provider";
import { Icon, type IconName } from "../icon";
import { Text } from "../text";
import {
  buttonLabelTone,
  buttonLabelVariant,
  buttonStyles,
  type ButtonSize,
  type ButtonVariant,
} from "./button.styles";

export interface ButtonProps extends Omit<PressableProps, "children" | "disabled" | "style"> {
  /** The label. An icon-only button omits it and must give `accessibilityLabel`. */
  readonly children?: string | undefined;
  readonly variant?: ButtonVariant | undefined;
  readonly size?: ButtonSize | undefined;
  readonly icon?: IconName | undefined;
  readonly iconEnd?: IconName | undefined;
  readonly loading?: boolean | undefined;
  readonly disabled?: boolean | undefined;
  readonly fullWidth?: boolean | undefined;
  readonly className?: string;
}

interface ContentProps {
  readonly children: string | undefined;
  readonly icon: IconName | undefined;
  readonly iconEnd: IconName | undefined;
  readonly size: ButtonSize;
  readonly tone: (typeof buttonLabelTone)[ButtonVariant];
  readonly hidden: boolean;
}

function ButtonContent({ children, icon, iconEnd, size, tone, hidden }: ContentProps) {
  const iconSize = size === "lg" ? "lg" : "md";
  return (
    <View className={cn("flex-row items-center gap-2", hidden && "opacity-0")}>
      {icon ? <Icon name={icon} size={iconSize} tone={tone} /> : null}
      {children ? (
        <Text variant={buttonLabelVariant[size]} tone={tone} numberOfLines={1}>
          {children}
        </Text>
      ) : null}
      {iconEnd ? <Icon name={iconEnd} size={iconSize} tone={tone} /> : null}
    </View>
  );
}

/**
 * The one button. States: default, hover (web), pressed, focus-visible (web), disabled, loading.
 * Loading keeps the size (the label turns invisible, the spinner sits on top) and announces busy.
 *
 *   <Button onPress={save}>Save</Button>
 *   <Button variant="secondary" icon="filter" size="sm">Filters</Button>
 *   <Button variant="ghost" icon="x" accessibilityLabel="Close" onPress={close} />
 */
export function Button({
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
}: ButtonProps) {
  const { resolved } = useTheme();
  const inactive = disabled || loading;
  const tone = buttonLabelTone[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? children}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      className={cn(buttonStyles({ variant, size, fullWidth }), className)}
      {...rest}
    >
      <ButtonContent icon={icon} iconEnd={iconEnd} size={size} tone={tone} hidden={loading}>
        {children}
      </ButtonContent>
      {loading ? (
        // Absolute: the spinner sits over the invisible label so the button keeps its size while busy.
        <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
          <ActivityIndicator
            color={colors[tone === "onBrand" ? "brand-ink" : "brand"][resolved]}
            testID="button-spinner"
          />
        </View>
      ) : null}
    </Pressable>
  );
}
