import { Platform, View, type AccessibilityProps, type ViewProps } from "react-native";

import { announcementText, useAnnounce } from "../../hooks/use-announce";
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
  /**
   * Announce the title and description when the view appears (ErrorState, OfflineState): role alert
   * on the web, a live region on Android, useAnnounce on iOS.
   */
  readonly announce?: boolean | undefined;
  readonly className?: string;
}

type AnnounceProps = Pick<AccessibilityProps, "accessibilityRole" | "accessibilityLiveRegion">;

/** Makes the description an alert, plus a live region on Android, when the view announces. */
function announceProps(announce: boolean): AnnounceProps {
  if (!announce) return {};
  // Android reads role alert as a role description only, so its live region is what speaks there;
  // the web keeps the alert alone, since a polite live region would soften its assertive default.
  return Platform.OS === "android"
    ? { accessibilityRole: "alert", accessibilityLiveRegion: "polite" }
    : { accessibilityRole: "alert" };
}

function StateActionButton({ action }: { action: StateAction }) {
  return (
    <Button
      variant="secondary"
      onPress={action.onPress}
      loading={action.loading ?? false}
      className="mt-2"
    >
      {action.label}
    </Button>
  );
}

/**
 * The shape behind EmptyState, ErrorState and OfflineState: icon, title, one paragraph, one action.
 * With `announce`, the title and description are spoken when the view appears.
 *
 *   <StateView icon="alert-triangle" title="Upload failed" description="Nothing was saved." announce />
 */
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
  useAnnounce(announcementText(title, description), announce);
  return (
    <View className={cn("items-center justify-center gap-3 px-6 py-10", className)} {...rest}>
      <View className="h-14 w-14 items-center justify-center rounded-full bg-surface-inset">
        <Icon name={icon} size="xl" tone={iconTone} />
      </View>
      <Text variant="heading" align="center">
        {title}
      </Text>
      {description ? (
        <Text tone="muted" align="center" className="max-w-sm" {...announceProps(announce)}>
          {description}
        </Text>
      ) : null}
      {action ? <StateActionButton action={action} /> : null}
    </View>
  );
}
