import { uiCopy } from "../../copy";
import { cn } from "../../lib/cn";
import { Button } from "../button";

export interface LoadMoreProps {
  /** Whether another page is available; the control renders nothing when false. */
  readonly hasMore: boolean;
  /** The next page is loading (the button shows a busy state and ignores presses). */
  readonly loading: boolean;
  /** The last attempt errored; the button labels itself as a retry (the loaded pages stay on screen). */
  readonly failed?: boolean | undefined;
  readonly onLoadMore: () => void;
  /** Defaults to `uiCopy.loadMore` (or `uiCopy.loadMoreRetry` after a failed attempt). */
  readonly label?: string | undefined;
  readonly className?: string | undefined;
  readonly testID?: string | undefined;
}

/**
 * The "Load more" footer for a cursor-paginated list: a full-width secondary button that fetches the next
 * page, shows a busy state while it loads, labels itself as a retry if the last attempt failed, and renders
 * nothing once the list is exhausted (`hasMore` false). It never discards the pages already on screen.
 *
 *   <LoadMore hasMore={leads.hasMore} loading={leads.isLoadingMore} failed={leads.loadMoreError} onLoadMore={leads.loadMore} />
 */
export function LoadMore({
  hasMore,
  loading,
  failed = false,
  onLoadMore,
  label,
  className,
  testID,
}: LoadMoreProps) {
  if (!hasMore) return null;
  return (
    <Button
      variant="secondary"
      fullWidth
      loading={loading}
      onPress={onLoadMore}
      className={cn(className)}
      testID={testID ?? "load-more"}
    >
      {failed ? uiCopy.loadMoreRetry : (label ?? uiCopy.loadMore)}
    </Button>
  );
}
