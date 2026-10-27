import { uiCopy } from "../../copy";
import { announcementText, useAnnounce } from "../../hooks/use-announce";
import { isHiddenFromVoiceOver } from "../../lib/accessibility-hidden";
import { StateView, type StateViewProps } from "../state-view";

export interface OfflineStateProps extends Omit<
  StateViewProps,
  // No announce: OfflineState announces itself politely, and a second announcer would speak twice.
  "icon" | "iconTone" | "title" | "action" | "announce"
> {
  readonly title?: string | undefined;
  readonly retryLabel?: string | undefined;
  readonly onRetry?: (() => void) | undefined;
}

/**
 * The team app's offline screen (W-10): what is stale, what is kept, how to retry. Announced when it
 * appears, unless its props hide it from VoiceOver or display none: the live region on Android and the web,
 * useAnnounce on iOS.
 *
 *   {isOffline ? <OfflineState onRetry={refetch} /> : null}
 */
export function OfflineState({
  title = uiCopy.offline.title,
  description = uiCopy.offline.description,
  retryLabel = uiCopy.retry,
  onRetry,
  ...rest
}: OfflineStateProps) {
  // Polite, not an alert: being offline is a state to know about, not an error to act on now.
  useAnnounce(announcementText(title, description), !isHiddenFromVoiceOver(rest));
  return (
    <StateView
      icon="wifi-off"
      iconTone="warning"
      title={title}
      description={description}
      action={onRetry ? { label: retryLabel, onPress: onRetry } : undefined}
      accessibilityLiveRegion="polite"
      {...rest}
    />
  );
}
