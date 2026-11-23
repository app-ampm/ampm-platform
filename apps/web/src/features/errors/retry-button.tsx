import { buttonLabelStyles, buttonStyles, cn } from "@ampm/ui/styles";

export interface RetryButtonProps {
  /** Next's `retry`: fetch the failed page again and draw it. */
  readonly onRetry: () => void;
  /** The words on the pill. */
  readonly children: string;
}

/**
 * The error pages' gold "Try again": a real button (the site's ButtonLink is a link) in the kit's
 * pill, with its hover, press and focus halo. Only the client error pages render it.
 *
 *   <RetryButton onRetry={retry}>Try again</RetryButton>
 */
export function RetryButton({ onRetry, children }: RetryButtonProps) {
  return (
    <button type="button" onClick={() => onRetry()} className={buttonStyles({ size: "lg" })}>
      <span className={cn(buttonLabelStyles({ size: "lg" }), "whitespace-nowrap")}>{children}</span>
    </button>
  );
}
