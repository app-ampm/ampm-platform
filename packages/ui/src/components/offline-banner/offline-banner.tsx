import { View, type ViewProps } from "react-native";

import { uiCopy } from "../../copy";
import { announcementText, politeLiveRegion, useAnnounce } from "../../hooks/use-announce";
import { isHiddenFromVoiceOver } from "../../lib/accessibility-hidden";
import { cn } from "../../lib/cn";
import { TextAction } from "../callout/text-action";
import { GlassPanel } from "../glass-panel";
import { Text } from "../text";
import { offlineBannerDotStyles, offlineBannerStyles } from "./offline-banner.styles";

export interface OfflineBannerProps extends ViewProps {
  /** Updates waiting to sync, after the title: "Offline · 3 updates queued". 0 shows the title alone. */
  readonly queuedCount?: number | undefined;
  readonly title?: string | undefined;
  /** The second line; defaults to what happens to queued (or future) changes. */
  readonly description?: string | undefined;
  /** Adds a gold retry action at the end of the pill. */
  readonly onRetry?: (() => void) | undefined;
  readonly retryLabel?: string | undefined;
  /** The banner is a top-level panel; inside another glass panel it passes false. */
  readonly blur?: boolean | undefined;
  readonly className?: string;
}

interface BannerTextProps {
  readonly title: string;
  readonly queued: string | undefined;
  readonly description: string;
}

function BannerText({ title, queued, description }: BannerTextProps) {
  return (
    // Shrinks to wrap on a narrow phone; grows in a full-width banner so the retry sits at the end.
    <View className="shrink grow gap-0.5">
      <Text
        variant="label"
        weight="bold"
        tone="primary"
        // Spoken with a pause instead of the middle dot.
        accessibilityLabel={queued ? `${title}, ${queued}` : undefined}
      >
        {queued ? `${title} · ${queued}` : title}
      </Text>
      {description ? (
        <Text variant="bodySmall" tone="body">
          {description}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The team app's offline banner on its offline-capable screens (tasks, live console, readiness,
 * arrivals): a peacock glass pill saying the screen still works and how many updates wait to sync.
 * Announced politely when it appears and when the count changes (its live region on Android, the
 * page's live region on the web, VoiceOver on iOS: useAnnounce), unless its props hide it from
 * VoiceOver or display none. For a screen that cannot work offline, show OfflineState instead.
 *
 *   {isOffline ? <OfflineBanner queuedCount={queue.length} onRetry={syncNow} /> : null}
 */
export function OfflineBanner({
  queuedCount = 0,
  title = uiCopy.offlineBanner.title,
  description,
  onRetry,
  retryLabel = uiCopy.retry,
  blur = true,
  className,
  ...rest
}: OfflineBannerProps) {
  const queued = queuedCount > 0 ? uiCopy.offlineBanner.queued(queuedCount) : undefined;
  const body =
    description ??
    (queued ? uiCopy.offlineBanner.description : uiCopy.offlineBanner.idleDescription);
  useAnnounce(
    announcementText(title, queued, body),
    !isHiddenFromVoiceOver({ ...rest, className }),
    { web: true },
  );
  return (
    <GlassPanel
      recipe="peacock"
      blur={blur}
      {...politeLiveRegion()}
      className={cn(offlineBannerStyles, className)}
      {...rest}
    >
      <View className={offlineBannerDotStyles} />
      <BannerText title={title} queued={queued} description={body} />
      {onRetry ? <TextAction label={retryLabel} onPress={onRetry} className="self-center" /> : null}
    </GlassPanel>
  );
}
