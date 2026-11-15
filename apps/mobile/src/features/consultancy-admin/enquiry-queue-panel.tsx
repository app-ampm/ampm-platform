import { useRouter } from "expo-router";

import { useStaffEnquiries } from "@ampm/api-client";
import type { HotelEnquiryStage } from "@ampm/core";
import { Card, Row, Stack, Text } from "@ampm/ui";

import { queueEyebrow } from "./consultancy-admin.format";
import { EnquiryQueueCard } from "./enquiry-queue-card";
import { EnquiryQueueStates } from "./enquiry-queue-states";
import { EnquiryStageFilter } from "./enquiry-stage-filter";
import { enquiryHref, useSetQueueStage } from "./queue-stage";

/**
 * T6's queue column on a desktop: one glass panel (22 inside, radius 26) headed "Enquiries" in Gilda 28
 * with the open count at its right, the pipeline's stage filter, then the enquiries as flat cards, the
 * open one selected. It fills its column's height, so it runs as long as the enquiry beside it, as T6
 * does. The filter is the address's `stage` param, so it holds while enquiries open beside it (an
 * enquiry opens with `setParams`, which keeps it) and survives a refresh or a shared link.
 *
 * Choosing an enquiry changes the open one in place, at its own address: on an enquiry's page the
 * route's id changes (no new screen, so the queue keeps its scroll and Back does not walk through
 * every enquiry viewed); on the queue's own page, before the first enquiry has opened, that page is
 * replaced. Choosing the one already open does nothing.
 */
/** Opens an enquiry beside the queue: in place on an enquiry's page, replacing the queue's own page. */
function useOpenInPlace(openId: string | undefined, stage: HotelEnquiryStage | null) {
  const router = useRouter();
  return (id: string): void => {
    if (id === openId) return;
    if (openId === undefined) router.replace(enquiryHref(id, stage));
    else router.setParams({ id });
  };
}

export function EnquiryQueuePanel({
  openId,
  stage,
}: {
  readonly openId: string | undefined;
  readonly stage: HotelEnquiryStage | null;
}) {
  const setStage = useSetQueueStage();
  const enquiries = useStaffEnquiries({ stage: stage ?? undefined });
  const onOpen = useOpenInPlace(openId, stage);
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
      <EnquiryStageFilter value={stage} onChange={setStage} />
      <EnquiryQueueStates enquiries={enquiries} inPanel filtered={stage !== null}>
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
