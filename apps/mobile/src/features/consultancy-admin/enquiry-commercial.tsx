import {
  useReviseProposal,
  useShareProposal,
  useStaffProposals,
  useStaffServiceAgreements,
  useTransitionServiceAgreement,
} from "@ampm/api-client";
import {
  clientAmount,
  formatAmount,
  internalAmount,
  type HotelProposalInternalView,
  type ServiceAgreementStaffView,
  type ServiceAgreementStatus,
} from "@ampm/core";
import {
  Button,
  Card,
  MoneyText,
  Row,
  Skeleton,
  Stack,
  StatusChip,
  Text,
  useToast,
} from "@ampm/ui";

import { formatDate } from "../consultancy/consultancy.format";
import { SectionError } from "../consultancy/section-error";
import { staffAgreementBadge, staffProposalBadge } from "./consultancy-admin.format";
import { TransitionRow } from "./transition-row";
import { CreateToggle } from "./consultancy-admin.widgets";
import { ProposalCreateForm } from "./proposal-create-form";

const AGREEMENT_NEXT: Record<ServiceAgreementStatus, readonly ServiceAgreementStatus[]> = {
  draft: ["sent", "cancelled"],
  sent: ["accepted", "cancelled"],
  accepted: ["active", "cancelled"],
  active: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

/** The service agreement(s) for this enquiry; staff move them draft→sent→accepted→active→completed. */
export function AgreementSection({ enquiryId }: { readonly enquiryId: string }) {
  const agreements = useStaffServiceAgreements({ hotelEnquiryId: enquiryId });
  if (agreements.isPending) return <SectionSkeleton title="Service agreements" />;
  if (agreements.isError)
    return (
      <SectionError
        title="Service agreements"
        error={agreements.error}
        onRetry={() => void agreements.refetch()}
      />
    );
  if (agreements.data.items.length === 0) return null;
  return (
    <Stack gap={2}>
      <Text variant="subheading">Service agreements</Text>
      {agreements.data.items.map((agreement) => (
        <AgreementCard key={agreement.id} agreement={agreement} enquiryId={enquiryId} />
      ))}
    </Stack>
  );
}

function AgreementCard({
  agreement,
  enquiryId,
}: {
  readonly agreement: ServiceAgreementStaffView;
  readonly enquiryId: string;
}) {
  const toast = useToast();
  const transition = useTransitionServiceAgreement(agreement.id, enquiryId);
  const badge = staffAgreementBadge[agreement.status];
  const move = (status: ServiceAgreementStatus): void =>
    transition.mutate(
      { status },
      { onError: () => toast.show({ title: "Could not move the agreement", tone: "danger" }) },
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
        <TransitionRow
          nexts={AGREEMENT_NEXT[agreement.status]}
          pending={transition.isPending}
          onMove={move}
        />
      </Stack>
    </Card>
  );
}

/** The versioned proposals, as staff see them: the internal total, the derived margin and every line. */
export function ProposalsSection({ enquiryId }: { readonly enquiryId: string }) {
  const proposals = useStaffProposals(enquiryId);
  if (proposals.isPending) return <SectionSkeleton title="Proposals" />;
  if (proposals.isError)
    return (
      <SectionError
        title="Proposals"
        error={proposals.error}
        onRetry={() => void proposals.refetch()}
      />
    );
  return (
    <Stack gap={2}>
      <Text variant="subheading">Proposals</Text>
      {proposals.data.items.map((proposal) => (
        <ProposalCard key={proposal.id} proposal={proposal} enquiryId={enquiryId} />
      ))}
      <CreateToggle label="New proposal">
        {(done) => <ProposalCreateForm enquiryId={enquiryId} onDone={done} />}
      </CreateToggle>
    </Stack>
  );
}

function ProposalCard({
  proposal,
  enquiryId,
}: {
  readonly proposal: HotelProposalInternalView;
  readonly enquiryId: string;
}) {
  const badge = staffProposalBadge[proposal.status];
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
        <ProposalInternalTotals proposal={proposal} />
        <ProposalLines lines={proposal.lines} />
        {proposal.validUntil ? (
          <Text tone="muted">{`Valid until ${formatDate(proposal.validUntil)}`}</Text>
        ) : null}
        <ProposalActions proposal={proposal} enquiryId={enquiryId} />
      </Stack>
    </Card>
  );
}

/** The RESTRICTED-FINANCE figures a client never sees — absent (not rendered) for a reader without the grant. */
function ProposalInternalTotals({ proposal }: { readonly proposal: HotelProposalInternalView }) {
  return (
    <Stack gap={0}>
      {proposal.internalTotal ? (
        <Text variant="bodySmall" tone="muted">
          {`Internal ${formatAmount(internalAmount(proposal.internalTotal.minor, proposal.internalTotal.currency))}`}
        </Text>
      ) : null}
      {proposal.margin ? (
        <Text variant="bodySmall" tone="muted">
          {`Margin ${formatAmount(internalAmount(proposal.margin.minor, proposal.margin.currency))}`}
        </Text>
      ) : null}
    </Stack>
  );
}

function ProposalLines({ lines }: { readonly lines: HotelProposalInternalView["lines"] }) {
  if (lines.length === 0) return null;
  return (
    <Stack gap={1}>
      {lines.map((line) => (
        <Row key={line.id} gap={2} justify="between">
          <Text tone="muted" className="flex-1">
            {`${line.description} × ${line.quantity}`}
          </Text>
          {line.clientVisible ? null : <StatusChip label="internal" tone="warning" size="sm" />}
          <Text>
            {formatAmount(internalAmount(line.totalAmount.minor, line.totalAmount.currency))}
          </Text>
        </Row>
      ))}
    </Stack>
  );
}

/** Share a draft with the client, or supersede a shared version with a fresh draft to re-price. */
function ProposalActions({
  proposal,
  enquiryId,
}: {
  readonly proposal: HotelProposalInternalView;
  readonly enquiryId: string;
}) {
  const toast = useToast();
  const share = useShareProposal(proposal.id, enquiryId);
  const revise = useReviseProposal(proposal.id, enquiryId);
  const onError = (): void => {
    toast.show({ title: "Could not update the proposal", tone: "danger" });
  };
  if (proposal.status === "draft") {
    return (
      <Button
        fullWidth
        loading={share.isPending}
        onPress={() => share.mutate(undefined, { onError })}
      >
        Share with client
      </Button>
    );
  }
  if (proposal.status === "shared" || proposal.status === "revision_requested") {
    return (
      <Button
        variant="secondary"
        loading={revise.isPending}
        onPress={() => revise.mutate(undefined, { onError })}
      >
        Revise (new version)
      </Button>
    );
  }
  return null;
}

function SectionSkeleton({ title }: { readonly title: string }) {
  return (
    <Stack gap={2}>
      <Text variant="subheading">{title}</Text>
      <Skeleton className="h-24 w-full" />
    </Stack>
  );
}
