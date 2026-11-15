import { useHotelProposals, useServiceAgreements } from "@ampm/api-client";
import { Stack, Text } from "@ampm/ui";

import { ClientAgreementCard } from "./client-agreement-card";
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
      <ClientAgreementCard agreement={agreement} />
    </Stack>
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
