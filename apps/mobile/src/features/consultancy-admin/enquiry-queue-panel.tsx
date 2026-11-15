import { useState } from "react";
import { useRouter } from "expo-router";

import { useStaffEnquiries } from "@ampm/api-client";
import type { HotelEnquiryStage } from "@ampm/core";
import { Card, Row, Stack, Text } from "@ampm/ui";

import { queueEyebrow } from "./consultancy-admin.format";
import { EnquiryQueueCard } from "./enquiry-queue-card";
import { EnquiryQueueStates } from "./enquiry-queue-states";
import { EnquiryStageFilter } from "./enquiry-stage-filter";

/**
 * T6's queue column on a desktop: one glass panel (22 inside, radius 26) headed "Enquiries" in Gilda 28
 * with the open count at its right, the pipeline's stage filter, then the enquiries as flat cards, the
 * open one selected. It fills its column's height, so it runs as long as the enquiry beside it, as T6
 * does. The filter is the panel's own state, so it holds while enquiries open beside it.
 *
 * Choosing an enquiry changes the open one in place, at its own address: on an enquiry's page the
 * route's id changes (no new screen, so the queue keeps its scroll and Back does not walk through
 * every enquiry viewed); on the queue's own page, before the first enquiry has opened, that page is
 * replaced. Choosing the one already open does nothing.
 */
export function EnquiryQueuePanel({ openId }: { readonly openId: string | undefined }) {
  const router = useRouter();
  const [stage, setStage] = useState<HotelEnquiryStage | null>(null);
  const enquiries = useStaffEnquiries({ stage: stage ?? undefined });
  const onOpen = (id: string): void => {
    if (id === openId) return;
    if (openId === undefined) router.replace(`/enquiries/${id}`);
    else router.setParams({ id });
  };
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
