import { View, type ViewProps } from "react-native";

import { uiCopy } from "../../copy";
import { announcementText, useAnnounce } from "../../hooks/use-announce";
import { cn } from "../../lib/cn";
import { Button } from "../button";
import { Icon, type IconName } from "../icon";
import { chipStyles, chipTextTone, type StatusTone } from "../status-chip/status-chip.styles";
import { Text } from "../text";

/** The product's recurring notices (ui.md) plus the generic tones. */
export type CalloutKind =
  | "indicative"
  | "requested"
  | "verified"
  | "awaiting-confirmation"
  | "offline"
  | "pending-sync"
  | "info"
  | "success"
  | "warning"
  | "danger";

interface KindSpec {
  readonly tone: StatusTone;
  readonly icon: IconName;
  readonly live: boolean;
}

export const calloutKinds: Record<CalloutKind, KindSpec> = {
  indicative: { tone: "info", icon: "info", live: false },
  requested: { tone: "warning", icon: "clock", live: false },
  verified: { tone: "success", icon: "check-circle", live: false },
  "awaiting-confirmation": { tone: "warning", icon: "clock", live: false },
  offline: { tone: "neutral", icon: "wifi-off", live: true },
  "pending-sync": { tone: "info", icon: "refresh", live: true },
  info: { tone: "info", icon: "info", live: false },
  success: { tone: "success", icon: "check-circle", live: false },
  warning: { tone: "warning", icon: "alert-triangle", live: false },
  danger: { tone: "danger", icon: "alert-circle", live: true },
};

export interface CalloutProps extends ViewProps {
  readonly kind: CalloutKind;
  /** Defaults to the kind's own title (uiCopy). */
  readonly title?: string | undefined;
  /** One or two sentences under the title. */
  readonly children?: string | undefined;
  readonly action?: { readonly label: string; readonly onPress: () => void } | undefined;
  readonly className?: string;
}

/**
 * A framed notice for the states AMPM's screens repeat: indicative, requested, verified, awaiting
 * confirmation, offline, pending sync. Offline, pending-sync and danger are announced when they appear
 * (a live region on Android, useAnnounce on iOS).
 *
 *   <Callout kind="indicative">Rates verified on 12 March; the hotel confirms on request.</Callout>
 */
export function Callout({ kind, title, children, action, className, ...rest }: CalloutProps) {
  const spec = calloutKinds[kind];
  const textTone = chipTextTone[spec.tone];
  const heading = title ?? uiCopy.callout[kind];
  // The live region speaks on Android; VoiceOver ignores it, so live kinds announce there too.
  useAnnounce(announcementText(heading, children), spec.live);
  return (
    <View
      className={cn(
        chipStyles({ tone: spec.tone }),
        "items-start gap-3 self-stretch rounded-lg p-3",
        className,
      )}
      accessibilityLiveRegion={spec.live ? "polite" : "none"}
      {...rest}
    >
      <Icon name={spec.icon} tone={textTone} className="mt-0.5" />
      <View className="flex-1 gap-1">
        <Text
          variant="label"
          tone={textTone}
          {...(kind === "danger" ? { accessibilityRole: "alert" as const } : {})}
        >
          {heading}
        </Text>
        {children ? <Text variant="bodySmall">{children}</Text> : null}
        {action ? (
          <Button variant="ghost" size="sm" className="-ml-3" onPress={action.onPress}>
            {action.label}
          </Button>
        ) : null}
      </View>
    </View>
  );
}
