import { useDecideHotelProposal } from "@ampm/api-client";
import { clientAmount, type HotelProposalClientView, type HotelProposalDecision } from "@ampm/core";
import { Button, Card, Divider, MoneyText, Row, Stack, StatusChip, Text, useToast } from "@ampm/ui";

import { proposalBadge, proposalDates } from "./consultancy.format";
import { useInDetailPanel } from "./enquiry-surface";

interface ProposalProps {
  readonly proposal: HotelProposalClientView;
}

/** The version and its status; the dates in pearl 80% on the gold card (58% falls under 4.5:1 there). */
function ProposalHeading({ proposal, isOpen }: ProposalProps & { readonly isOpen: boolean }) {
  const badge = proposalBadge[proposal.status];
  const dates = proposalDates(proposal);
  return (
    <Stack gap={1.5}>
      <Row gap={3} justify="between" align="start">
        <Text variant="heading" className="flex-1">
          {`Proposal, version ${proposal.versionNumber}`}
        </Text>
        <StatusChip label={badge.label} tone={badge.tone} size="sm" />
      </Row>
      {dates ? (
        <Text variant="data" tone={isOpen ? "body" : "muted"} className="uppercase">
          {dates}
        </Text>
      ) : null}
    </Stack>
  );
}

/** The client-visible lines and the client total; a gold hairline over the total on the gold card. */
function ProposalLines({ proposal, isOpen }: ProposalProps & { readonly isOpen: boolean }) {
  const total = clientAmount(proposal.clientTotal.minor, proposal.clientTotal.currency);
  return (
    <Stack gap={2.5}>
      {proposal.lines.map((line) => (
        <Row key={line.id} gap={4} justify="between" align="start">
          <Text className="flex-1">{`${line.description} × ${line.quantity}`}</Text>
          <MoneyText
            amount={clientAmount(line.totalAmount.minor, line.totalAmount.currency)}
            variant="body"
          />
        </Row>
      ))}
      {proposal.lines.length > 0 ? (
        <Divider className={isOpen ? "bg-brand/30" : undefined} />
      ) : null}
      <Row gap={4} justify="between" align="center">
        <Text weight="semibold" tone="primary" className="flex-1">
          Total
        </Text>
        <MoneyText amount={total} variant="subheading" />
      </Row>
    </Stack>
  );
}

/** Records the client's decision; a press while one is in flight is ignored. */
function useProposalDecision(proposalId: string, enquiryId: string) {
  const toast = useToast();
  const decide = useDecideHotelProposal(proposalId, enquiryId);
  const pending = decide.isPending ? decide.variables?.decision : undefined;
  const onDecide = (decision: HotelProposalDecision): void => {
    if (decide.isPending) return;
    decide.mutate(
      { decision },
      { onError: () => toast.show({ title: "Could not record your decision", tone: "danger" }) },
    );
  };
  return { pending, onDecide };
}

type Decision = ReturnType<typeof useProposalDecision>;

/** Asking for a revision (secondary) and declining (the gold outline): never the gold fill. */
function OtherDecisions({ pending, onDecide }: Decision) {
  return (
    <>
      <Button
        variant="secondary"
        loading={pending === "revision_requested"}
        onPress={() => onDecide("revision_requested")}
      >
        Request a revision
      </Button>
      <Button
        variant="destructive"
        loading={pending === "declined"}
        onPress={() => onDecide("declined")}
      >
        Decline
      </Button>
    </>
  );
}

/**
 * The client's decision on a shared proposal (CP-10): accept (the screen's gold action), ask for a
 * revision, or decline. The pressed button shows the busy state; the others ignore presses until the
 * decision is recorded. A phone gives the gold action the full width; the desktop panel sets all three
 * in one row (D8).
 */
function ProposalDecision({ proposal, enquiryId }: ProposalProps & { readonly enquiryId: string }) {
  const decision = useProposalDecision(proposal.id, enquiryId);
  const inPanel = useInDetailPanel();
  const accept = (
    <Button
      fullWidth={!inPanel}
      loading={decision.pending === "accepted"}
      onPress={() => decision.onDecide("accepted")}
    >
      Accept proposal
    </Button>
  );
  if (inPanel)
    return (
      <Row gap={2.5} wrap>
        {accept}
        <OtherDecisions {...decision} />
      </Row>
    );
  return (
    <Stack gap={2.5}>
      {accept}
      <Row gap={2.5} wrap>
        <OtherDecisions {...decision} />
      </Row>
    </Stack>
  );
}

/**
 * One proposal version (D8): gold glass while it waits on the client's decision, base glass once
 * decided or replaced. Inside the desktop detail panel it does not blur, and a decided one is a flat
 * tint. Client amounts only; the internal total and margin never reach this view.
 */
export function ProposalCard({
  proposal,
  enquiryId,
}: ProposalProps & { readonly enquiryId: string }) {
  const isOpen = proposal.status === "shared";
  const inPanel = useInDetailPanel();
  const closedTone = inPanel ? "flat" : "glass";
  return (
    <Card
      tone={isOpen ? "gold" : closedTone}
      blur={!inPanel}
      padding="lg"
      testID={`proposal-${proposal.id}`}
    >
      <Stack gap={4}>
        <ProposalHeading proposal={proposal} isOpen={isOpen} />
        <ProposalLines proposal={proposal} isOpen={isOpen} />
        {isOpen ? <ProposalDecision proposal={proposal} enquiryId={enquiryId} /> : null}
      </Stack>
    </Card>
  );
}
