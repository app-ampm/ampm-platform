import { View, type ViewProps } from "react-native";

import { cn } from "../../lib/cn";
import { Button } from "../button";
import { Icon, type IconName, type IconTone } from "../icon";
import { Text } from "../text";

export interface StateAction {
  readonly label: string;
  readonly onPress: () => void;
  readonly loading?: boolean | undefined;
}

export interface StateViewProps extends ViewProps {
  readonly icon: IconName;
  readonly iconTone?: IconTone | undefined;
  readonly title: string;
  readonly description?: string | undefined;
  readonly action?: StateAction | undefined;
  /** Announce the description when the view appears (ErrorState). */
  readonly announce?: boolean | undefined;
  readonly className?: string;
}

/** The shape behind EmptyState, ErrorState and OfflineState: icon, title, one paragraph, one action. */
export function StateView({
  icon,
  iconTone = "muted",
  title,
  description,
  action,
  announce = false,
  className,
  ...rest
}: StateViewProps) {
  return (
    <View className={cn("items-center justify-center gap-3 px-6 py-10", className)} {...rest}>
      <View className="h-14 w-14 items-center justify-center rounded-full bg-surface-inset">
        <Icon name={icon} size="xl" tone={iconTone} />
      </View>
      <Text variant="heading" align="center">
        {title}
      </Text>
      {description ? (
        <Text
          tone="muted"
          align="center"
          className="max-w-sm"
          {...(announce ? { accessibilityRole: "alert" as const } : {})}
        >
          {description}
        </Text>
      ) : null}
      {action ? (
        <Button
          variant="secondary"
          onPress={action.onPress}
          loading={action.loading ?? false}
          className="mt-2"
        >
          {action.label}
        </Button>
      ) : null}
    </View>
  );
}
