import type { HotelEnquiryStaffView } from "@ampm/core";
import { Callout, Stack, Stepper } from "@ampm/ui";

import { nextStep, PIPELINE_STEPS, pipelineIndex, type EnquiryTab } from "./enquiry-next-step";

const TAB_ACTION: Record<EnquiryTab, string> = {
  overview: "Open the overview",
  proposals: "Go to proposals",
  activity: "Go to activity",
  booking: "Go to booking",
};

/**
 * Where the enquiry stands in the team's pipeline, under its header: the five steps as a stepper
 * (New request → With the hotel → Proposal → Client decision → Confirmed) and, under it, the one
 * thing to do next, with a link to the tab that holds the work when another tab is open.
 */
export function EnquiryPipelineStrip({
  enquiry,
  tab,
  onOpenTab,
  blur,
}: {
  readonly enquiry: Pick<HotelEnquiryStaffView, "status" | "outcome" | "latestProposal">;
  readonly tab: EnquiryTab;
  readonly onOpenTab: (tab: EnquiryTab) => void;
  /** False inside the desktop pane: only top-level panels blur. */
  readonly blur: boolean;
}) {
  const step = nextStep(enquiry);
  const target = step.tab !== null && step.tab !== tab ? step.tab : null;
  return (
    <Stack gap={3} testID="enquiry-pipeline">
      <Stepper
        steps={PIPELINE_STEPS}
        current={pipelineIndex(enquiry.status)}
        accessibilityLabel="Enquiry pipeline"
      />
      <Callout
        kind={step.kind}
        title={step.title}
        blur={blur}
        action={
          target ? { label: TAB_ACTION[target], onPress: () => onOpenTab(target) } : undefined
        }
        testID="enquiry-next-step"
      >
        {step.detail}
      </Callout>
    </Stack>
  );
}
