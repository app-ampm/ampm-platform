import type { useHotelEnquiries } from "@ampm/api-client";
import { Card, LoadMore, Text } from "@ampm/ui";

import { RequestCard } from "./request-card";
import { RequestsStates } from "./requests-states";

export interface RequestsPanelProps {
  readonly enquiries: ReturnType<typeof useHotelEnquiries>;
  /** The enquiry open beside the list, if any. */
  readonly selectedId: string | undefined;
  readonly onOpen: (enquiryId: string) => void;
}

/**
 * D8's list column on a desktop: one glass panel (22 inside, radius 28) titled "Enquiries" in Gilda 28,
 * holding the enquiry cards with the open one selected. Its loading, error and empty states sit on the
 * panel, flat. It fills its column's height, so it runs as long as the enquiry beside it, as D8 does.
 */
export function RequestsPanel({ enquiries, selectedId, onOpen }: RequestsPanelProps) {
  return (
    <Card padding="none" className="flex-1 gap-2 p-5.5 md:rounded-2xl" testID="requests-panel">
      <Text variant="heading" className="px-1.5 pb-3 pt-1 text-3xl">
        Enquiries
      </Text>
      <RequestsStates enquiries={enquiries} inPanel>
        {enquiries.items.map((enquiry) => (
          <RequestCard
            key={enquiry.id}
            enquiry={enquiry}
            selected={enquiry.id === selectedId}
            onOpen={() => onOpen(enquiry.id)}
          />
        ))}
        <LoadMore
          hasMore={enquiries.hasMore}
          loading={enquiries.isLoadingMore}
          failed={enquiries.loadMoreError}
          onLoadMore={enquiries.loadMore}
          testID="requests-load-more"
        />
      </RequestsStates>
    </Card>
  );
}
