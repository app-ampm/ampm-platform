import { Card, Skeleton, Stack } from "@ampm/ui";

import { BARE_CARD, useInDetailPanel } from "../consultancy/enquiry-surface";
import { PANE_FRAME } from "./use-section-card";

/**
 * The shapes of the loaded enquiry while it arrives, so nothing jumps: on a phone a card and a panel
 * under the page's header; on a desktop the pane itself, its header's two lines over the same shapes.
 */
export function EnquiryPaneLoading() {
  const inPanel = useInDetailPanel();
  return (
    <Card
      padding="none"
      tone={inPanel ? "glass" : "flat"}
      className={inPanel ? PANE_FRAME : `${BARE_CARD} gap-4`}
      testID="staff-enquiry-loading"
    >
      {inPanel ? (
        <Stack gap={2}>
          <Skeleton shape="text" className="w-72" />
          <Skeleton className="h-10 w-96" />
        </Stack>
      ) : null}
      <Card tone={inPanel ? "flat" : "glass"}>
        <Stack gap={3}>
          <Skeleton shape="text" className="w-40" />
          <Skeleton className="h-16 w-full" />
        </Stack>
      </Card>
      <Skeleton className="h-36 w-full rounded-lg" />
    </Card>
  );
}
