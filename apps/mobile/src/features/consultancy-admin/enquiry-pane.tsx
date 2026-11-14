import { useStaffEnquiry } from "@ampm/api-client";
import { Card, QueryErrorState } from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { BARE_CARD, useInDetailPanel } from "../consultancy/enquiry-surface";
import { ROLE_WITHOUT_GRANT } from "./consultancy-admin.format";
import { EnquiryActivity } from "./enquiry-activity";
import { AgreementSection, ProposalsSection } from "./enquiry-commercial";
import { EnquiryHeading } from "./enquiry-heading";
import { EnquiryPaneLoading } from "./enquiry-pane-loading";
import { MilestonesSection, VisitsSection } from "./enquiry-progress";
import { EnquiryStatusActions } from "./enquiry-status-actions";
import { PANE_FRAME } from "./use-section-card";

/**
 * One enquiry and its pipeline, in T6's order at every width: the thread (switch, notes, events), the
 * proposals, the status moves, the agreements, the site visits and the milestones. On a phone and a
 * tablet the sections stack as glass cards under the page's header; on a desktop they fold into one
 * glass pane that carries the header itself, their cards flat on it. The header's slot is empty below
 * 1024 and only the frame's props change, so the sections keep their place, and a form being filled
 * in or the thread's switch keeps its state, when the window crosses 1024.
 */
export function EnquiryPane({ enquiryId }: { readonly enquiryId: string }) {
  const enquiry = useStaffEnquiry(enquiryId);
  const inPanel = useInDetailPanel();
  const goToSignIn = useGoToSignIn();
  if (enquiry.isPending) return <EnquiryPaneLoading />;
  if (enquiry.isError)
    return (
      <QueryErrorState
        error={enquiry.error}
        onRetry={() => void enquiry.refetch()}
        onSignIn={goToSignIn}
        signIn={{ title: "Sign in to view this enquiry" }}
        notFound={{ title: "Enquiry not found" }}
        forbidden={ROLE_WITHOUT_GRANT}
      />
    );
  return (
    <Card
      padding="none"
      tone={inPanel ? "glass" : "flat"}
      className={inPanel ? PANE_FRAME : `${BARE_CARD} gap-4`}
      testID={inPanel ? "enquiry-pane" : undefined}
    >
      {inPanel ? <EnquiryHeading enquiry={enquiry.data} /> : null}
      <EnquiryActivity enquiry={enquiry.data} />
      <ProposalsSection enquiryId={enquiryId} />
      <EnquiryStatusActions enquiryId={enquiryId} status={enquiry.data.status} />
      <AgreementSection enquiryId={enquiryId} accountId={enquiry.data.accountId} />
      <VisitsSection enquiryId={enquiryId} />
      <MilestonesSection enquiryId={enquiryId} />
    </Card>
  );
}
