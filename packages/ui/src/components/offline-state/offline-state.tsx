import { uiCopy } from "../../copy";
import { announcementText, politeLiveRegion, useAnnounce } from "../../hooks/use-announce";
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
 * The team app's offline screen (W-10): what is stale, what is kept, how to retry. The wifi-off icon
 * is peacock, the offline-safe colour (not a warning). Announced when it appears, unless its props hide
 * it from VoiceOver or display none: its live region on Android, the page's live region on the web,
 * VoiceOver on iOS (useAnnounce). For a screen that keeps working offline, show the OfflineBanner
 * instead.
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
  useAnnounce(announcementText(title, description), !isHiddenFromVoiceOver(rest), { web: true });
  return (
    <StateView
      icon="wifi-off"
      iconTone="highlight"
      title={title}
      description={description}
      action={onRetry ? { label: retryLabel, onPress: onRetry } : undefined}
      {...politeLiveRegion()}
      {...rest}
    />
  );
}
