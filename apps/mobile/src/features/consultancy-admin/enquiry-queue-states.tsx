import type { ReactNode } from "react";

import type { useStaffEnquiries } from "@ampm/api-client";
import type { HotelEnquiryStaffPage } from "@ampm/core";
import { Card, EmptyState, QueryErrorState, Skeleton, Stack } from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { ROLE_WITHOUT_GRANT } from "./consultancy-admin.format";

export interface EnquiryQueueStatesProps {
  readonly enquiries: ReturnType<typeof useStaffEnquiries>;
  /**
   * Inside T6's glass queue panel on a desktop: the states are drawn flat on it (only the panel blurs).
   * On a phone they stand on the page as their own glass.
   */
  readonly inPanel?: boolean | undefined;
  /** The queue, once it has enquiries. */
  readonly children: (page: HotelEnquiryStaffPage) => ReactNode;
}

/**
 * The queue's loading, error and empty states, the same on a phone's page and in the desktop queue
 * panel; the queue itself once it has enquiries.
 */
export function EnquiryQueueStates({
  enquiries,
  inPanel = false,
  children,
}: EnquiryQueueStatesProps) {
  const goToSignIn = useGoToSignIn();
  if (enquiries.isPending) return <QueueLoading inPanel={inPanel} />;
  if (enquiries.isError)
    return (
      <QueryErrorState
        error={enquiries.error}
        onRetry={() => void enquiries.refetch()}
        onSignIn={goToSignIn}
        signIn={{ title: "Sign in to view enquiries" }}
        forbidden={ROLE_WITHOUT_GRANT}
        blur={!inPanel}
      />
    );
  if (enquiries.data.items.length === 0)
    return (
      <EmptyState
        icon="inbox"
        title="No hotel enquiries yet"
        description="Enquiries arrive here when a client asks AMPM to check a hotel."
        blur={!inPanel}
      />
    );
  return children(enquiries.data);
}

/** Rows the height of the loaded ones, so the queue does not jump on arrival. */
function QueueLoading({ inPanel }: { readonly inPanel: boolean }) {
  const rows = (
    <Stack gap={2} testID="staff-enquiries-loading">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </Stack>
  );
  if (inPanel) return rows;
  return (
    <Card padding="sm" className="md:p-5.5">
      {rows}
    </Card>
  );
}
