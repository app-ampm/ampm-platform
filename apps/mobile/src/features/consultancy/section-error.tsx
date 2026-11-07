import { isAppError } from "@ampm/core";
import { QueryErrorState, Stack, Text } from "@ampm/ui";

export interface SectionErrorProps {
  readonly title: string;
  readonly error: unknown;
  readonly onRetry: () => void;
}

/**
 * The error/offline treatment the detail sub-sections share (the four-state rule, ui.md). A section with
 * no rows renders nothing, but a section whose query FAILED must not — hiding a failed proposals load would
 * read as "no proposal to decide" when one may be awaiting the client. Network errors show offline; the
 * rest show the retryable error state, under the section's Gilda heading. The owning screen already
 * handles the enquiry's own auth/not-found.
 *
 *   <SectionError title="Proposals" error={proposals.error} onRetry={retry} />
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
 * A sub-resource the reader may not see is absence, not a failure, so the section hides rather than
 * loop on a retry that is always refused: a staff sub-role without the section's grant (403), or a
 * record outside the reader's reach, which the API answers with the same 404 as a missing one
 * (security.md: denial equals absence).
 */
function isRefused(error: unknown): boolean {
  return isAppError(error) && (error.code === "forbidden" || error.code === "not_found");
}
