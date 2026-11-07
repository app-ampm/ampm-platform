import { Skeleton, Stack } from "@ampm/ui";

/**
 * The portal while `/me` loads: the header's two lines, then a status panel and a larger panel. Which
 * page follows (activation or the subscriber home) depends on the entitlements still loading.
 */
export function PortalLoading() {
  return (
    <Stack gap={4} testID="portal-loading" accessible accessibilityLabel="Loading your plan">
      <Stack gap={2}>
        <Skeleton shape="text" className="w-32" />
        <Skeleton shape="text" className="w-56" />
      </Stack>
      <Skeleton className="h-28 w-full rounded-lg" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </Stack>
  );
}
