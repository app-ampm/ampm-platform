import { uiCopy } from "../../copy";
import { StateView, type StateViewProps } from "../state-view";

export interface ErrorStateProps extends Omit<
  StateViewProps,
  "icon" | "iconTone" | "title" | "action"
> {
  readonly title?: string | undefined;
  readonly retryLabel?: string | undefined;
  readonly onRetry?: (() => void) | undefined;
  readonly retrying?: boolean | undefined;
}

/**
 * Something failed: a gold icon (Peacock Night has no red), a message that never shows a raw error
 * (code.md), and a retry. Announced as an alert when it appears.
 *
 *   <ErrorState onRetry={refetch} retrying={isRefetching} />
 */
export function ErrorState({
  title = uiCopy.error.title,
  description = uiCopy.error.description,
  retryLabel = uiCopy.retry,
  onRetry,
  retrying = false,
  ...rest
}: ErrorStateProps) {
  return (
    <StateView
      icon="alert-triangle"
      iconTone="brand"
      title={title}
      description={description}
      action={onRetry ? { label: retryLabel, onPress: onRetry, loading: retrying } : undefined}
      announce
      {...rest}
    />
  );
}
