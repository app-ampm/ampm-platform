import { isAppError } from "@ampm/core";
import { ErrorState, OfflineState, Stack, Text } from "@ampm/ui";

/**
 * The error/offline treatment the detail sub-sections share (the four-state rule, ui.md). A section with
 * no rows renders nothing, but a section whose query FAILED must not — hiding a failed proposals load would
 * read as "no proposal to decide" when one may be awaiting the client. Network errors show offline; the
 * rest show the retryable error state. The owning screen already handles the enquiry's own auth/not-found.
 */
export function SectionError({
  title,
  error,
  onRetry,
}: {
  readonly title: string;
  readonly error: unknown;
  readonly onRetry: () => void;
}) {
  // A forbidden sub-resource — a staff sub-role without this section's grant — is absence, not a
  // retryable error: hide the section rather than loop on a retry that will always 403.
  if (isAppError(error) && error.code === "forbidden") return null;
  const offline = isAppError(error) && error.code === "network_error";
  return (
    <Stack gap={2}>
      <Text variant="subheading">{title}</Text>
      {offline ? <OfflineState onRetry={onRetry} /> : <ErrorState onRetry={onRetry} />}
    </Stack>
  );
}
