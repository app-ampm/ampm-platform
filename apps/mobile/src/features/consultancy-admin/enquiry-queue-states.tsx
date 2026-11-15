import type { ReactNode } from "react";

import type { useStaffEnquiries } from "@ampm/api-client";
import type {
  HotelEnquiryAssigneeFilter,
  HotelEnquiryStaffPage,
  HotelEnquiryStage,
} from "@ampm/core";
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
  /** The filters on: an empty page then means none that match, not none at all. */
  readonly stage?: HotelEnquiryStage | null | undefined;
  readonly assignee?: HotelEnquiryAssigneeFilter | null | undefined;
  /** The queue, once it has enquiries. */
  readonly children: (page: HotelEnquiryStaffPage) => ReactNode;
}

/**
 * What an empty, filtered queue says: which filter found nothing, and how to see more. Null with no
 * filter on (the queue is simply empty).
 */
export function filteredEmptyCopy(
  stage: HotelEnquiryStage | null,
  assignee: HotelEnquiryAssigneeFilter | null,
): { readonly title: string; readonly description: string } | null {
  const atStage = stage === null ? "" : " at this stage";
  if (assignee === "me")
    return {
      title: "Nothing of yours open",
      description: `No open enquiry${atStage} is assigned to you. Choose Everyone to see the whole queue.`,
    };
  if (assignee === "unassigned")
    return {
      title: "Nothing waiting for an owner",
      description: `Every open enquiry${atStage} has someone on the hotel team on it.`,
    };
  if (stage !== null)
    return {
      title: "Nothing at this stage",
      description: "No enquiry is at this stage right now. Choose All to see every one.",
    };
  return null;
}

/**
 * The queue's loading, error and empty states, the same on a phone's page and in the desktop queue
 * panel; the queue itself once it has enquiries.
 */
export function EnquiryQueueStates({
  enquiries,
  inPanel = false,
  stage = null,
  assignee = null,
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
  const filtered = filteredEmptyCopy(stage, assignee);
  if (enquiries.data.items.length === 0 && filtered)
    return <EmptyState icon="filter" {...filtered} blur={!inPanel} />;
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
