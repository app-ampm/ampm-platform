import { isAppError } from "@ampm/core";

import { Stack } from "../layout";
import { QueryErrorState } from "../query-error-state";
import { Text } from "../text";

export interface SectionErrorProps {
  readonly title: string;
  readonly error: unknown;
  readonly onRetry: () => void;
}

/**
 * The error/offline treatment a detail screen's sub-sections share (the four-state rule, ui.md). A
 * section with no rows renders nothing, but a section whose query FAILED must not — hiding a failed load
 * would read as "nothing here" when something may be awaiting attention. Network errors show offline; the
 * rest show the retryable error state under the section's heading. The owning screen handles its own
 * auth / not-found.
 *
 *   <SectionError title="Subscriptions" error={subscriptions.error} onRetry={retry} />
 */
export function SectionError({ title, error, onRetry }: SectionErrorProps) {
  if (isRefused(error)) return null;
  return (
    <Stack gap={3}>
      <Text variant="heading">{title}</Text>
      <QueryErrorState error={error} onRetry={onRetry} />
    </Stack>
  );
}

/**
 * A sub-resource the reader may not see is absence, not a failure, so the section hides rather than loop
 * on a retry that is always refused: a staff sub-role without the section's grant (403), or a record
 * outside the reader's reach, which the API answers with the same 404 as a missing one (security.md:
 * denial equals absence).
 */
function isRefused(error: unknown): boolean {
  return isAppError(error) && (error.code === "forbidden" || error.code === "not_found");
}
