import { useRouter } from "expo-router";

import { useHotel, useHotelEnquiry } from "@ampm/api-client";
import type { HotelEnquiryClientDetailView } from "@ampm/core";
import { Screen, ScreenHeader, StatusChip, useLayoutAt } from "@ampm/ui";

import { enquiryChip } from "./consultancy.format";
import { EnquiryDetail } from "./enquiry-detail";
import { RequestsSplit } from "./requests-split";

/**
 * CP: one hotel request and everything hanging off it (D8): the stay and its status stepper, the
 * agreement, the proposals, visits, milestones and the activity. On a phone and a tablet, a detail
 * screen: a back button and no tab bar. From 1024, D8's list beside this enquiry, selected in it; the
 * panel carries the title, so there is no page header. The same tree at every width: only the
 * wrappers' props change, so the enquiry keeps its state when a tablet turns or the window resizes.
 */
export function RequestDetailScreen({ enquiryId }: { readonly enquiryId: string }) {
  const isSplit = useLayoutAt("lg");
  const router = useRouter();
  const enquiry = useHotelEnquiry(enquiryId);
  return (
    <Screen
      width={isSplit ? "split" : "content"}
      header={isSplit ? null : <DetailHeader enquiry={enquiry.data} onBack={() => router.back()} />}
    >
      <RequestsSplit isSplit={isSplit} openId={enquiryId}>
        <EnquiryDetail enquiryId={enquiryId} />
      </RequestsSplit>
    </Screen>
  );
}

/**
 * The hotel's name as the title (read through the cached hotel query; "Hotel request" until it
 * arrives, or if it cannot), and the enquiry's status chip at its right once the enquiry has loaded.
 */
function DetailHeader({
  enquiry,
  onBack,
}: {
  readonly enquiry: HotelEnquiryClientDetailView | undefined;
  readonly onBack: () => void;
}) {
  // An empty id leaves the hotel query disabled until the enquiry names its hotel.
  const hotel = useHotel(enquiry?.hotelId ?? "");
  const chip = enquiry ? enquiryChip(enquiry) : null;
  return (
    <ScreenHeader
      eyebrow="Enquiry"
      title={hotel.data?.name ?? "Hotel request"}
      onBack={onBack}
      trailing={chip ? <StatusChip label={chip.label} tone={chip.tone} /> : null}
    />
  );
}
