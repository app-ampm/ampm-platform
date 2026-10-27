import { uiCopy } from "../../copy";
import { StateView, type StateViewProps } from "../state-view";

export interface OfflineStateProps extends Omit<
  StateViewProps,
  "icon" | "iconTone" | "title" | "action"
> {
  readonly title?: string | undefined;
  readonly retryLabel?: string | undefined;
  readonly onRetry?: (() => void) | undefined;
}

/** The team app's offline screen (W-10): what is stale, what is kept, how to retry. */
export function OfflineState({
  title = uiCopy.offline.title,
  description = uiCopy.offline.description,
  retryLabel = uiCopy.retry,
  onRetry,
  ...rest
}: OfflineStateProps) {
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
