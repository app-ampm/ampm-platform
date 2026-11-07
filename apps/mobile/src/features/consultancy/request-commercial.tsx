import {
  useAcceptServiceAgreement,
  useHotelProposals,
  useServiceAgreements,
} from "@ampm/api-client";
import { clientAmount, type ServiceAgreementClientView } from "@ampm/core";
import { Button, Callout, Card, MoneyText, Row, Stack, StatusChip, Text, useToast } from "@ampm/ui";

import { agreementBadge } from "./consultancy.format";
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
 * The agreement's scope and fee. Accepting it is a confirmation, so its button is peacock (highlight):
 * the screen's one gold action stays the proposal's "Accept proposal".
 */
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
    <Card padding="lg">
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
        {agreement.status === "sent" ? (
          <Button variant="highlight" fullWidth loading={accept.isPending} onPress={onAccept}>
            Accept agreement
          </Button>
        ) : null}
        {agreement.status === "accepted" ? (
          <Callout
            kind="awaiting-confirmation"
            title="Accepted — AMPM will activate it shortly."
            blur={false}
          />
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
    <Stack gap={3}>
      <Text variant="heading">Proposals</Text>
      {proposals.data.items.map((proposal) => (
        <ProposalCard key={proposal.id} proposal={proposal} enquiryId={enquiryId} />
      ))}
    </Stack>
  );
}
