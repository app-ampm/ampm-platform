import {
  useAcceptServiceAgreement,
  useHotelProposals,
  useServiceAgreements,
} from "@ampm/api-client";
import { clientAmount, type ServiceAgreementClientView } from "@ampm/core";
import { Button, Callout, Card, MoneyText, Row, Stack, StatusChip, Text, useToast } from "@ampm/ui";

import { agreementBadge } from "./consultancy.format";
import { useInDetailPanel } from "./enquiry-surface";
import { ProposalCard } from "./proposal-card";
import { SectionError } from "./section-error";
import { SectionSkeleton } from "./section-skeleton";

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
    <Stack gap={3}>
      <Text variant="heading">Service agreement</Text>
      <AgreementCard agreement={agreement} />
    </Stack>
  );
}

/**
 * Accepting a `sent` agreement, or the note that AMPM is activating an accepted one. Accepting is a
 * confirmation, so its button is peacock (highlight): the screen's one gold action stays the proposal's
 * "Accept proposal". Full width on a phone; its own width in the desktop panel, as D8's actions are.
 */
function AgreementAction({ agreement }: { readonly agreement: ServiceAgreementClientView }) {
  const toast = useToast();
  const accept = useAcceptServiceAgreement(agreement.id);
  const inPanel = useInDetailPanel();
  const onAccept = (): void =>
    accept.mutate(
      { termsAccepted: true },
      { onError: () => toast.show({ title: "Could not accept the agreement", tone: "danger" }) },
    );
  if (agreement.status === "sent")
    return (
      <Button
        variant="highlight"
        fullWidth={!inPanel}
        loading={accept.isPending}
        onPress={onAccept}
      >
        Accept agreement
      </Button>
    );
  if (agreement.status === "accepted")
    return (
      <Callout
        kind="awaiting-confirmation"
        title="Accepted — AMPM will activate it shortly."
        blur={false}
      />
    );
  return null;
}

/** The agreement's scope and fee, and what the client can do with it. */
function AgreementCard({ agreement }: { readonly agreement: ServiceAgreementClientView }) {
  const badge = agreementBadge[agreement.status];
  const inPanel = useInDetailPanel();
  return (
    <Card padding="lg" tone={inPanel ? "flat" : "glass"}>
      <Stack gap={3.5}>
        <Row gap={3} justify="between" align="start">
          <Text variant="heading" className="flex-1">
            {agreement.serviceName}
          </Text>
          <StatusChip label={badge.label} tone={badge.tone} size="sm" />
        </Row>
        <Text>{agreement.scopeText}</Text>
        <MoneyText
          amount={clientAmount(agreement.fee.minor, agreement.fee.currency)}
          variant="subheading"
        />
        <AgreementAction agreement={agreement} />
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
    <Stack gap={3}>
      <Text variant="heading">Proposals</Text>
      {proposals.data.items.map((proposal) => (
        <ProposalCard key={proposal.id} proposal={proposal} enquiryId={enquiryId} />
      ))}
    </Stack>
  );
}
