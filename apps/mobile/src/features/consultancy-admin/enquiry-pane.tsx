import { useState } from "react";

import { useStaffEnquiry } from "@ampm/api-client";
import type { HotelEnquiryStaffDetailView } from "@ampm/core";
import { Card, QueryErrorState, SegmentedControl, Stack } from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { BARE_CARD, useInDetailPanel } from "../consultancy/enquiry-surface";
import { ROLE_WITHOUT_GRANT } from "./consultancy-admin.format";
import { EnquiryActivity } from "./enquiry-activity";
import { EnquiryClientCard } from "./enquiry-client-card";
import { AgreementSection, ProposalsSection } from "./enquiry-commercial";
import { EnquiryHeading } from "./enquiry-heading";
import { EnquiryOwnerCard } from "./enquiry-owner-card";
import { initialTab, type EnquiryTab } from "./enquiry-next-step";
import { EnquiryPaneLoading } from "./enquiry-pane-loading";
import { EnquiryPipelineStrip } from "./enquiry-pipeline-strip";
import { MilestonesSection, VisitsSection } from "./enquiry-progress";
import { EnquiryRequestCard } from "./enquiry-request-card";
import { EnquiryStatusActions } from "./enquiry-status-actions";
import { PANE_FRAME } from "./use-section-card";

const TABS: ReadonlyArray<{ readonly value: EnquiryTab; readonly label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "proposals", label: "Proposals" },
  { value: "activity", label: "Activity" },
  { value: "booking", label: "Booking" },
];

function isTab(value: string): value is EnquiryTab {
  return TABS.some((tab) => tab.value === value);
}

/**
 * One enquiry and its pipeline. Under the header, where it stands (the pipeline stepper and the next
 * step), then four tabs instead of one long scroll: Overview (who sent it, who on the team holds it,
 * what they asked for, and the status moves), Proposals (the versions, edited and shared here), Activity (the thread) and
 * Booking (agreements, site visits, milestones). It opens on the tab its next step is in. On a phone
 * and a tablet the parts stack as glass cards under the page's header; on a desktop they fold into one
 * glass pane that carries the header itself. The header's slot is empty below 1024 and only the
 * frame's props change, so the open tab, and a form being filled in, survive the window crossing 1024.
 */
export function EnquiryPane({ enquiryId }: { readonly enquiryId: string }) {
  const enquiry = useStaffEnquiry(enquiryId);
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
  return <EnquiryWorkspace enquiry={enquiry.data} />;
}

/** The loaded enquiry; its open tab starts where its next step is and then stays the person's. */
function EnquiryWorkspace({ enquiry }: { readonly enquiry: HotelEnquiryStaffDetailView }) {
  const inPanel = useInDetailPanel();
  const [tab, setTab] = useState<EnquiryTab>(() => initialTab(enquiry));
  return (
    <Card
      padding="none"
      tone={inPanel ? "glass" : "flat"}
      className={inPanel ? PANE_FRAME : `${BARE_CARD} gap-4`}
      testID={inPanel ? "enquiry-pane" : undefined}
    >
      {inPanel ? <EnquiryHeading enquiry={enquiry} /> : null}
      <EnquiryPipelineStrip enquiry={enquiry} tab={tab} onOpenTab={setTab} blur={!inPanel} />
      <SegmentedControl
        variant="underline"
        accessibilityLabel="Enquiry sections"
        options={TABS}
        value={tab}
        onChange={(value) => setTab(isTab(value) ? value : "overview")}
        scrollable
        testID="enquiry-tabs"
      />
      <EnquiryTabBody enquiry={enquiry} tab={tab} />
    </Card>
  );
}

function EnquiryTabBody({
  enquiry,
  tab,
}: {
  readonly enquiry: HotelEnquiryStaffDetailView;
  readonly tab: EnquiryTab;
}) {
  switch (tab) {
    case "overview":
      return (
        <Stack gap={4}>
          <EnquiryClientCard enquiry={enquiry} />
          <EnquiryOwnerCard enquiry={enquiry} />
          <EnquiryRequestCard enquiry={enquiry} />
          <EnquiryStatusActions enquiryId={enquiry.id} status={enquiry.status} />
        </Stack>
      );
    case "proposals":
      return <ProposalsSection enquiryId={enquiry.id} />;
    case "activity":
      return <EnquiryActivity enquiry={enquiry} />;
    case "booking":
      return (
        <Stack gap={6}>
          <AgreementSection enquiryId={enquiry.id} accountId={enquiry.accountId} />
          <VisitsSection enquiryId={enquiry.id} />
          <MilestonesSection enquiryId={enquiry.id} />
        </Stack>
      );
  }
}
