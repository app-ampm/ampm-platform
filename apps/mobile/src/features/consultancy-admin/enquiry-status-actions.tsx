import { useState } from "react";

import { useTransitionEnquiry } from "@ampm/api-client";
import type { HotelEnquiryOutcome, HotelEnquiryStatus } from "@ampm/core";
import { Button, Callout, Card, Row, Stack, Text, useToast } from "@ampm/ui";

import { errorMessage } from "./consultancy-admin.form";
import { staffEnquiryBadge, statusWords } from "./consultancy-admin.format";
import { useSectionCard } from "./use-section-card";

/**
 * The legal forward targets per status (the policy matrix §7 graph, role aside — the API still enforces
 * the per-role rule and the data guards, so e.g. →confirmed 409s until the milestones are done). `closed`
 * is split out because it needs an outcome. The first target is the pipeline's next step.
 */
const NEXT: Record<HotelEnquiryStatus, readonly HotelEnquiryStatus[]> = {
  draft: ["submitted", "closed"],
  submitted: ["awaiting_hotel", "proposal_received", "closed"],
  awaiting_hotel: ["response_received", "proposal_received", "closed"],
  response_received: ["negotiating", "visit_scheduled", "proposal_received", "closed"],
  negotiating: ["visit_scheduled", "proposal_received", "closed"],
  visit_scheduled: ["proposal_received", "closed"],
  proposal_received: ["client_decision", "closed"],
  client_decision: ["confirmed", "proposal_received", "closed"],
  confirmed: ["closed"],
  closed: [],
};

const OUTCOMES: readonly HotelEnquiryOutcome[] = [
  "booked",
  "declined",
  "no_availability",
  "withdrawn",
];

type Move = (to: HotelEnquiryStatus, outcome?: HotelEnquiryOutcome | null) => void;

/** Moves the enquiry; a denied (403) or guard-blocked (409) move says why in a toast. */
function useEnquiryMove(enquiryId: string): { readonly move: Move; readonly pending: boolean } {
  const toast = useToast();
  const transition = useTransitionEnquiry(enquiryId);
  const move: Move = (to, outcome = null) =>
    transition.mutate(
      { status: to, outcome, summary: null },
      {
        onError: (error) =>
          toast.show({ title: errorMessage(error, "Could not change the status"), tone: "danger" }),
      },
    );
  return { move, pending: transition.isPending };
}

/**
 * The enquiry's pipeline controls: the next step as the screen's one gold button, the other legal
 * moves secondary, and a close flow that needs an outcome.
 */
export function EnquiryStatusActions({
  enquiryId,
  status,
}: {
  readonly enquiryId: string;
  readonly status: HotelEnquiryStatus;
}) {
  const { move, pending } = useEnquiryMove(enquiryId);
  const [closing, setClosing] = useState(false);
  const card = useSectionCard();
  const nexts = NEXT[status];
  if (nexts.length === 0)
    return <Callout kind="info" title="This enquiry is closed." blur={card.tone === "glass"} />;
  return (
    <Stack gap={3}>
      <Text variant="heading">Advance</Text>
      <Card tone={card.tone} className={card.className}>
        <Stack gap={4}>
          <Row gap={2} wrap>
            <ForwardButtons nexts={nexts} pending={pending} onMove={move} />
            {nexts.includes("closed") ? (
              <Button
                variant="secondary"
                size="sm"
                aria-expanded={closing}
                onPress={() => setClosing((open) => !open)}
              >
                Close…
              </Button>
            ) : null}
          </Row>
          {closing ? <CloseOutcomes pending={pending} onClose={move} /> : null}
        </Stack>
      </Card>
    </Stack>
  );
}

/** Every legal move but closing: the first, the pipeline's next step, gold; the others secondary. */
function ForwardButtons({
  nexts,
  pending,
  onMove,
}: {
  readonly nexts: readonly HotelEnquiryStatus[];
  readonly pending: boolean;
  readonly onMove: Move;
}) {
  return (
    <>
      {nexts
        .filter((to) => to !== "closed")
        .map((to, index) => (
          <Button
            key={to}
            variant={index === 0 ? "primary" : "secondary"}
            size="sm"
            loading={pending}
            onPress={() => onMove(to)}
          >
            {staffEnquiryBadge[to].label}
          </Button>
        ))}
    </>
  );
}

function CloseOutcomes({
  pending,
  onClose,
}: {
  readonly pending: boolean;
  readonly onClose: Move;
}) {
  return (
    <Stack gap={2}>
      <Text variant="label" tone="muted">
        Close with outcome
      </Text>
      <Row gap={2} wrap>
        {OUTCOMES.map((outcome) => (
          <Button
            key={outcome}
            variant="secondary"
            size="sm"
            loading={pending}
            onPress={() => onClose("closed", outcome)}
          >
            {statusWords(outcome)}
          </Button>
        ))}
      </Row>
    </Stack>
  );
}
