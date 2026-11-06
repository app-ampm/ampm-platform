import { useState } from "react";

import { useTransitionEnquiry } from "@ampm/api-client";
import type { HotelEnquiryOutcome, HotelEnquiryStatus } from "@ampm/core";
import { Button, Callout, Row, Stack, Text, useToast } from "@ampm/ui";

import { staffEnquiryBadge } from "./consultancy-admin.format";

/**
 * The legal forward targets per status (the policy matrix §7 graph, role aside — the API still enforces
 * the per-role rule and the data guards, so e.g. →confirmed 409s until the milestones are done). `closed`
 * is split out because it needs an outcome.
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

/** The enquiry status stepper: a button per legal next status, plus a close flow that needs an outcome. */
export function EnquiryStatusActions({
  enquiryId,
  status,
}: {
  readonly enquiryId: string;
  readonly status: HotelEnquiryStatus;
}) {
  const toast = useToast();
  const transition = useTransitionEnquiry(enquiryId);
  const [closing, setClosing] = useState(false);
  const nexts = NEXT[status];
  const move = (to: HotelEnquiryStatus, outcome: HotelEnquiryOutcome | null = null): void =>
    transition.mutate(
      { status: to, outcome, summary: null },
      { onError: (error) => toast.show({ title: moveError(error), tone: "danger" }) },
    );
  if (nexts.length === 0) return <Callout kind="info" title="This enquiry is closed." />;
  return (
    <Stack gap={2}>
      <Text variant="subheading">Advance</Text>
      <Row gap={2} wrap>
        {nexts
          .filter((to) => to !== "closed")
          .map((to) => (
            <Button key={to} size="sm" loading={transition.isPending} onPress={() => move(to)}>
              {staffEnquiryBadge[to].label}
            </Button>
          ))}
        {nexts.includes("closed") ? (
          <Button variant="ghost" size="sm" onPress={() => setClosing((open) => !open)}>
            Close…
          </Button>
        ) : null}
      </Row>
      {closing ? <CloseOutcomes pending={transition.isPending} onClose={move} /> : null}
    </Stack>
  );
}

function CloseOutcomes({
  pending,
  onClose,
}: {
  readonly pending: boolean;
  readonly onClose: (to: HotelEnquiryStatus, outcome: HotelEnquiryOutcome) => void;
}) {
  return (
    <Stack gap={1}>
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
            {outcome.replace(/_/g, " ")}
          </Button>
        ))}
      </Row>
    </Stack>
  );
}

/** A denied transition (403) or an unmet guard (409) carries a useful message; surface it. */
function moveError(error: unknown): string {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" && message.length > 0
    ? message
    : "Could not change the status";
}
