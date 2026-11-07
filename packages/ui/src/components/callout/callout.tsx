import { View, type ViewProps } from "react-native";

import { uiCopy } from "../../copy";
import { announcementText, politeLiveRegion, useAnnounce } from "../../hooks/use-announce";
import { isHiddenFromVoiceOver } from "../../lib/accessibility-hidden";
import { cn } from "../../lib/cn";
import { GlassPanel, type GlassRecipeName } from "../glass-panel";
import { Icon, type IconName, type IconTone } from "../icon";
import { Text } from "../text";
import { calloutStyles } from "./callout.styles";
import { TextAction } from "./text-action";

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

export interface CalloutKindSpec {
  /** base for notes, gold for waiting and needs-you, peacock for verified and offline-safe. */
  readonly recipe: GlassRecipeName;
  readonly icon: IconName;
  /** Pearl, or gold on gold glass; peacock glass keeps a pearl icon (peacock on peacock is too faint). */
  readonly iconTone: IconTone;
  /** Announced when it appears: offline, pending sync and danger. */
  readonly live: boolean;
}

export const calloutKinds: Record<CalloutKind, CalloutKindSpec> = {
  indicative: { recipe: "base", icon: "info", iconTone: "primary", live: false },
  requested: { recipe: "gold", icon: "clock", iconTone: "brand", live: false },
  verified: { recipe: "peacock", icon: "check-circle", iconTone: "primary", live: false },
  "awaiting-confirmation": { recipe: "gold", icon: "clock", iconTone: "brand", live: false },
  offline: { recipe: "peacock", icon: "wifi-off", iconTone: "primary", live: true },
  "pending-sync": { recipe: "peacock", icon: "refresh", iconTone: "primary", live: true },
  info: { recipe: "base", icon: "info", iconTone: "primary", live: false },
  success: { recipe: "peacock", icon: "check-circle", iconTone: "primary", live: false },
  warning: { recipe: "gold", icon: "alert-triangle", iconTone: "brand", live: false },
  // Needs you: gold, never red (Peacock Night has no red).
  danger: { recipe: "gold", icon: "alert-circle", iconTone: "brand", live: true },
};

export interface CalloutAction {
  readonly label: string;
  readonly onPress: () => void;
}

export interface CalloutProps extends ViewProps {
  readonly kind: CalloutKind;
  /** Defaults to the kind's own title (uiCopy). */
  readonly title?: string | undefined;
  /** One or two sentences under the title. */
  readonly children?: string | undefined;
  /** A gold text action under the text ("Retry now"). */
  readonly action?: CalloutAction | undefined;
  /** A callout inside another glass panel passes false: only top-level panels blur. */
  readonly blur?: boolean | undefined;
  readonly className?: string;
}

interface CalloutBodyProps {
  readonly heading: string;
  readonly isAlert: boolean;
  readonly children: string | undefined;
  readonly action: CalloutAction | undefined;
}

function CalloutBody({ heading, isAlert, children, action }: CalloutBodyProps) {
  return (
    <View className="flex-1 gap-1">
      <Text variant="label" tone="primary" accessibilityRole={isAlert ? "alert" : undefined}>
        {heading}
      </Text>
      {children ? (
        <Text variant="bodySmall" tone="body">
          {children}
        </Text>
      ) : null}
      {action ? (
        <TextAction label={action.label} onPress={action.onPress} className="mt-1" />
      ) : null}
    </View>
  );
}

/**
 * A notice in glass for the states AMPM's screens repeat: indicative (base glass), requested and
 * awaiting confirmation (gold), verified (peacock), offline and pending sync (peacock, offline-safe),
 * plus info, success, warning and danger (gold: needs you). Offline, pending-sync and danger are
 * announced when they appear (their live region on Android, VoiceOver on iOS, and on the web the
 * page's live region, or role alert for danger), unless their props hide them from VoiceOver or
 * display none.
 *
 *   <Callout kind="indicative">Rates verified on 12 March; the hotel confirms on request.</Callout>
 *   <Callout kind="pending-sync" action={{ label: "Retry now", onPress: retry }}>3 changes waiting.</Callout>
 *   <Callout kind="verified" blur={false}>Inside a card: no second blur.</Callout>
 */
export function Callout({
  kind,
  title,
  children,
  action,
  blur = true,
  className,
  ...rest
}: CalloutProps) {
  const spec = calloutKinds[kind];
  const heading = title ?? uiCopy.callout[kind];
  const isAlert = kind === "danger";
  // Android speaks the live region and VoiceOver the announcement. On the web, danger's heading is
  // an alert, which speaks as it appears; the polite kinds speak through the page's live region.
  useAnnounce(
    announcementText(heading, children),
    spec.live && !isHiddenFromVoiceOver({ ...rest, className }),
    { web: spec.live && !isAlert },
  );
  return (
    <GlassPanel
      recipe={spec.recipe}
      blur={blur}
      className={cn(calloutStyles, className)}
      {...(spec.live ? politeLiveRegion() : {})}
      {...rest}
    >
      <Icon name={spec.icon} tone={spec.iconTone} />
      <CalloutBody heading={heading} isAlert={isAlert} action={action}>
        {children}
      </CalloutBody>
    </GlassPanel>
  );
}
