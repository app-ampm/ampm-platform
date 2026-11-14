import { Card, Skeleton, Stack } from "@ampm/ui";

import { DETAIL_PANEL, useInDetailPanel } from "./enquiry-surface";

/**
 * An enquiry while it loads: the summary card and two section cards on a phone; the head, the stepper
 * and a section as skeletons inside D8's panel on a desktop.
 */
export function EnquiryDetailLoading() {
  const inPanel = useInDetailPanel();
  if (inPanel)
    return (
      <Card padding="none" className={DETAIL_PANEL} testID="request-detail-loading">
        <Skeleton shape="text" className="w-1/2" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-32 w-full" />
      </Card>
    );
  return (
    <Stack gap={4} testID="request-detail-loading">
      <Card padding="lg">
        <Stack gap={4.5}>
          <Skeleton shape="text" className="w-2/3" />
          <Skeleton className="h-14 w-full" />
        </Stack>
      </Card>
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </Stack>
  );
}
