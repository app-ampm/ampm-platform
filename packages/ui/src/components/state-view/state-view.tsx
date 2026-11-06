import { Platform, View, type AccessibilityProps, type ViewProps } from "react-native";

import { announcementText, useAnnounce } from "../../hooks/use-announce";
import { isHiddenFromVoiceOver } from "../../lib/accessibility-hidden";
import { cn } from "../../lib/cn";
import { Button } from "../button";
import { GlassPanel } from "../glass-panel";
import { Icon, type IconName, type IconTone } from "../icon";
import { Text } from "../text";
import { stateIconStyles, stateViewStyles } from "./state-view.styles";

/** Secondary unless the state's action is the screen's one gold primary action (the screen decides). */
export type StateActionVariant = "primary" | "secondary";

export interface StateAction {
  readonly label: string;
  readonly onPress: () => void;
  readonly loading?: boolean | undefined;
  readonly variant?: StateActionVariant | undefined;
}

export interface StateViewProps extends ViewProps {
  readonly icon: IconName;
  /** Pearl for empty states, gold for errors (never red), peacock for offline. */
  readonly iconTone?: IconTone | undefined;
  readonly title: string;
  readonly description?: string | undefined;
  readonly action?: StateAction | undefined;
  /**
   * Announce the title and description when the view appears (ErrorState): every platform speaks
   * both, through role alert on the web, a live region on Android and useAnnounce on iOS.
   */
  readonly announce?: boolean | undefined;
  /** A state inside another glass panel passes false: only top-level panels blur. */
  readonly blur?: boolean | undefined;
  readonly className?: string;
}

type AnnounceProps = Pick<AccessibilityProps, "accessibilityRole" | "accessibilityLiveRegion">;

/** Makes the title and description group an alert, plus a live region on Android, to announce. */
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
      variant={action.variant ?? "secondary"}
      onPress={action.onPress}
      loading={action.loading ?? false}
      className="mt-1"
    >
      {action.label}
    </Button>
  );
}

/**
 * The shape behind EmptyState, ErrorState and OfflineState: a full-area panel of base glass with the
 * icon in a pearl disc, a Gilda Display title, one paragraph and one action (secondary by default; a
 * screen's one gold action stays the screen's call). With `announce`, the title and description are
 * spoken when the view appears.
 *
 *   <StateView icon="alert-triangle" iconTone="brand" title="Upload failed" description="Nothing was saved." announce />
 */
export function StateView({
  icon,
  iconTone = "primary",
  title,
  description,
  action,
  announce = false,
  blur = true,
  className,
  ...rest
}: StateViewProps) {
  useAnnounce(
    announcementText(title, description),
    announce && !isHiddenFromVoiceOver({ ...rest, className }),
  );
  return (
    <GlassPanel blur={blur} className={cn(stateViewStyles, className)} {...rest}>
      <View className={stateIconStyles}>
        <Icon name={icon} size="lg" tone={iconTone} />
      </View>
      {/* One group around the title and description, so the web alert and the Android live
          region speak what useAnnounce says on iOS: the title too, description or not. */}
      <View className="items-center gap-2 self-stretch" {...announceProps(announce)}>
        <Text variant="heading" align="center">
          {title}
        </Text>
        {description ? (
          <Text tone="body" align="center" className="max-w-sm">
            {description}
          </Text>
        ) : null}
      </View>
      {action ? <StateActionButton action={action} /> : null}
    </GlassPanel>
  );
}
