import { useHotelEnquiry } from "@ampm/api-client";
import { Card, QueryErrorState } from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { EnquiryDetailLoading } from "./enquiry-detail-loading";
import { EnquirySummary } from "./enquiry-summary";
import { BARE_CARD, DETAIL_PANEL, useInDetailPanel } from "./enquiry-surface";
import { RequestSections } from "./request-sections";

/**
 * One enquiry and everything hanging off it: its summary, then the agreement, proposals, visits,
 * milestones, activity and the withdraw action. On a phone and a tablet the sections stack 24 apart as
 * glass cards of their own; on a desktop they fold into D8's one glass panel, their cards flat on it.
 * Only the frame's props change between the two, never the elements, so what the client has under way
 * (a note being written, feedback typed, a withdraw being confirmed) survives the window crossing 1024.
 * The live-chat thread and composer D8 draws in the panel are not built (B24).
 */
export function EnquiryDetail({ enquiryId }: { readonly enquiryId: string }) {
  const enquiry = useHotelEnquiry(enquiryId);
  const inPanel = useInDetailPanel();
  const goToSignIn = useGoToSignIn();
  if (enquiry.isPending) return <EnquiryDetailLoading />;
  if (enquiry.isError)
    return (
      <QueryErrorState
        error={enquiry.error}
        onRetry={() => void enquiry.refetch()}
        onSignIn={goToSignIn}
        signIn={{ title: "Sign in to view this request" }}
        notFound={{ title: "Request not found" }}
      />
    );
  return (
    <Card
      padding="none"
      tone={inPanel ? "glass" : "flat"}
      className={inPanel ? DETAIL_PANEL : `${BARE_CARD} gap-6`}
      testID={inPanel ? "request-detail-panel" : undefined}
    >
      <EnquirySummary enquiry={enquiry.data} />
      <RequestSections enquiry={enquiry.data} />
    </Card>
  );
}
