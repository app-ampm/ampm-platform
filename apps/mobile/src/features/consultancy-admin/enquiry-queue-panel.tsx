import { useRouter } from "expo-router";

import { useStaffEnquiries } from "@ampm/api-client";
import type { HotelEnquiryAssigneeFilter, HotelEnquiryStage } from "@ampm/core";
import { Card, Row, Stack, Text } from "@ampm/ui";

import { queueEyebrow } from "./consultancy-admin.format";
import { EnquiryAssigneeFilter } from "./enquiry-assignee-filter";
import { EnquiryQueueCard } from "./enquiry-queue-card";
import { EnquiryQueueStates } from "./enquiry-queue-states";
import { EnquiryStageFilter } from "./enquiry-stage-filter";
import { enquiryHref, useSetQueueAssignee, useSetQueueStage } from "./queue-filter";

/**
 * T6's queue column on a desktop: one glass panel (22 inside, radius 26) headed "Enquiries" in Gilda 28
 * with the open count at its right, the pipeline's stage filter, then the enquiries as flat cards, the
 * open one selected. It fills its column's height, so it runs as long as the enquiry beside it, as T6
 * does. Over the stages, the owner filter (everyone's, the reader's, or nobody's yet). The filters are
 * the address's `stage` and `assignee` params, so they hold while enquiries open beside them (an
 * enquiry opens with `setParams`, which keeps them) and survive a refresh or a shared link.
 *
 * Choosing an enquiry changes the open one in place, at its own address: on an enquiry's page the
 * route's id changes (no new screen, so the queue keeps its scroll and Back does not walk through
 * every enquiry viewed); on the queue's own page, before the first enquiry has opened, that page is
 * replaced. Choosing the one already open does nothing.
 */
/** Opens an enquiry beside the queue: in place on an enquiry's page, replacing the queue's own page. */
function useOpenInPlace(openId: string | undefined, filter: QueueFilterProps) {
  const router = useRouter();
  return (id: string): void => {
    if (id === openId) return;
    if (openId === undefined) router.replace(enquiryHref(id, filter.stage, filter.assignee));
    else router.setParams({ id });
  };
}

interface QueueFilterProps {
  readonly stage: HotelEnquiryStage | null;
  readonly assignee?: HotelEnquiryAssigneeFilter | null | undefined;
}

export function EnquiryQueuePanel({
  openId,
  stage,
  assignee = null,
}: QueueFilterProps & { readonly openId: string | undefined }) {
  const setStage = useSetQueueStage();
  const setAssignee = useSetQueueAssignee();
  const query = { stage: stage ?? undefined, assignee: assignee ?? undefined };
  const enquiries = useStaffEnquiries(query);
  const onOpen = useOpenInPlace(openId, { stage, assignee });
  return (
    <Card padding="none" className="flex-1 gap-2 p-5.5 md:rounded-2xl" testID="enquiry-queue-panel">
      <Row gap={3} justify="between" className="items-baseline px-1 pb-2.5 pt-0.5">
        <Text variant="heading" className="text-3xl">
          Enquiries
        </Text>
        {enquiries.isSuccess && enquiries.data.items.length > 0 ? (
          <Text variant="eyebrow">{queueEyebrow(enquiries.data)}</Text>
        ) : null}
      </Row>
      <EnquiryAssigneeFilter value={assignee} onChange={setAssignee} />
      <EnquiryStageFilter value={stage} onChange={setStage} />
      <EnquiryQueueStates enquiries={enquiries} inPanel stage={stage} assignee={assignee}>
        {(page) => (
          <Stack gap={2}>
            {page.items.map((enquiry) => (
              <EnquiryQueueCard
                key={enquiry.id}
                enquiry={enquiry}
                selected={enquiry.id === openId}
                onOpen={() => onOpen(enquiry.id)}
              />
            ))}
          </Stack>
        )}
      </EnquiryQueueStates>
    </Card>
  );
}
