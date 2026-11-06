import {
  useAcceptServiceAgreement,
  useDecideHotelProposal,
  useHotelProposals,
  useServiceAgreements,
} from "@ampm/api-client";
import {
  clientAmount,
  type HotelProposalClientView,
  type HotelProposalDecision,
  type ServiceAgreementClientView,
} from "@ampm/core";
import {
  Button,
  Callout,
  Card,
  MoneyText,
  Row,
  Skeleton,
  Stack,
  StatusChip,
  Text,
  useToast,
} from "@ampm/ui";

import { agreementBadge, formatDate, proposalBadge } from "./consultancy.format";
import { SectionError } from "./section-error";

/** The service agreement for this enquiry, if one was raised — the client accepts a `sent` one (GP-5). */
export function AgreementSection({ enquiryId }: { readonly enquiryId: string }) {
  // Filtered server-side by the enquiry, so a client with many agreements never pages past this one.
  const agreements = useServiceAgreements({ hotelEnquiryId: enquiryId });
  if (agreements.isPending) return <SectionSkeleton title="Service agreement" />;
  if (agreements.isError)
    return (
      <SectionError
        title="Service agreement"
        error={agreements.error}
        onRetry={() => void agreements.refetch()}
      />
    );
  const agreement = agreements.data.items[0];
  if (!agreement) return null;
  return (
    <Stack gap={2}>
      <Text variant="subheading">Service agreement</Text>
      <AgreementCard agreement={agreement} />
    </Stack>
  );
}

function AgreementCard({ agreement }: { readonly agreement: ServiceAgreementClientView }) {
  const toast = useToast();
  const accept = useAcceptServiceAgreement(agreement.id);
  const badge = agreementBadge[agreement.status];
  const onAccept = (): void =>
    accept.mutate(
      { termsAccepted: true },
      { onError: () => toast.show({ title: "Could not accept the agreement", tone: "danger" }) },
    );
  return (
    <Card>
      <Stack gap={2}>
        <Row gap={2} justify="between" align="start">
          <Text variant="subheading" className="flex-1">
            {agreement.serviceName}
          </Text>
          <StatusChip label={badge.label} tone={badge.tone} size="sm" />
        </Row>
        <Text tone="muted">{agreement.scopeText}</Text>
        <MoneyText
          amount={clientAmount(agreement.fee.minor, agreement.fee.currency)}
          variant="subheading"
        />
        {agreement.status === "sent" ? (
          <Button fullWidth loading={accept.isPending} onPress={onAccept}>
            Accept agreement
          </Button>
        ) : null}
        {agreement.status === "accepted" ? (
          <Callout kind="awaiting-confirmation" title="Accepted — AMPM will activate it shortly." />
        ) : null}
      </Stack>
    </Card>
  );
}

/** The versioned proposals — the client accepts, declines, or asks to revise a `shared` one (CP-10). */
export function ProposalsSection({ enquiryId }: { readonly enquiryId: string }) {
  const proposals = useHotelProposals(enquiryId);
  if (proposals.isPending) return <SectionSkeleton title="Proposals" />;
  if (proposals.isError)
    return (
      <SectionError
        title="Proposals"
        error={proposals.error}
        onRetry={() => void proposals.refetch()}
      />
    );
  if (proposals.data.items.length === 0) return null;
  return (
    <Stack gap={2}>
      <Text variant="subheading">Proposals</Text>
      {proposals.data.items.map((proposal) => (
        <ProposalCard key={proposal.id} proposal={proposal} enquiryId={enquiryId} />
      ))}
    </Stack>
  );
}

function ProposalCard({
  proposal,
  enquiryId,
}: {
  readonly proposal: HotelProposalClientView;
  readonly enquiryId: string;
}) {
  const toast = useToast();
  const decide = useDecideHotelProposal(proposal.id, enquiryId);
  const badge = proposalBadge[proposal.status];
  const onDecide = (decision: HotelProposalDecision): void =>
    decide.mutate(
      { decision },
      { onError: () => toast.show({ title: "Could not record your decision", tone: "danger" }) },
    );
  return (
    <Card>
      <Stack gap={2}>
        <Row gap={2} justify="between" align="start">
          <Text variant="subheading" className="flex-1">
            {`Version ${proposal.versionNumber}`}
          </Text>
          <StatusChip label={badge.label} tone={badge.tone} size="sm" />
        </Row>
        <MoneyText
          amount={clientAmount(proposal.clientTotal.minor, proposal.clientTotal.currency)}
          variant="title"
        />
        {proposal.validUntil ? (
          <Text tone="muted">{`Valid until ${formatDate(proposal.validUntil)}`}</Text>
        ) : null}
        <ProposalLines lines={proposal.lines} />
        {proposal.status === "shared" ? (
          <Stack gap={2}>
            <Button fullWidth loading={decide.isPending} onPress={() => onDecide("accepted")}>
              Accept proposal
            </Button>
            <Row gap={2}>
              <Button
                variant="secondary"
                size="sm"
                loading={decide.isPending}
                onPress={() => onDecide("revision_requested")}
              >
                Request changes
              </Button>
              <Button
                variant="ghost"
                size="sm"
                loading={decide.isPending}
                onPress={() => onDecide("declined")}
              >
                Decline
              </Button>
            </Row>
          </Stack>
        ) : null}
      </Stack>
    </Card>
  );
}

function ProposalLines({ lines }: { readonly lines: HotelProposalClientView["lines"] }) {
  if (lines.length === 0) return null;
  return (
    <Stack gap={1}>
      {lines.map((line) => (
        <Row key={line.id} gap={2} justify="between">
          <Text tone="muted" className="flex-1">
            {`${line.description} × ${line.quantity}`}
          </Text>
          <MoneyText amount={clientAmount(line.totalAmount.minor, line.totalAmount.currency)} />
        </Row>
      ))}
    </Stack>
  );
}

function SectionSkeleton({ title }: { readonly title: string }) {
  return (
    <Stack gap={2}>
      <Text variant="subheading">{title}</Text>
      <Skeleton className="h-24 w-full" />
    </Stack>
  );
}
