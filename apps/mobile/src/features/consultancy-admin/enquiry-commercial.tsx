import { useStaffProposals, useStaffServiceAgreements } from "@ampm/api-client";

import { SectionError } from "../consultancy/section-error";
import { SectionSkeleton } from "../consultancy/section-skeleton";
import { AgreementCard } from "./agreement-card";
import { AgreementCreateForm } from "./agreement-create-form";
import { CreateToggle } from "./consultancy-admin.widgets";
import { ProposalCard } from "./proposal-card";
import { ProposalCreateForm } from "./proposal-create-form";
import { SectionShell } from "./section-parts";

const AGREEMENTS_TITLE = "Service agreements";
const PROPOSALS_TITLE = "Proposals";

/** The service agreement(s) for this enquiry; staff draft them and move draft→sent→accepted→active→completed. */
export function AgreementSection({
  enquiryId,
  accountId,
}: {
  readonly enquiryId: string;
  readonly accountId: string;
}) {
  const agreements = useStaffServiceAgreements({ hotelEnquiryId: enquiryId });
  if (agreements.isPending)
    return <SectionSkeleton title={AGREEMENTS_TITLE} testID="agreements-loading" />;
  if (agreements.isError)
    return (
      <SectionError
        title={AGREEMENTS_TITLE}
        error={agreements.error}
        onRetry={() => void agreements.refetch()}
      />
    );
  const { items } = agreements.data;
  return (
    <SectionShell
      title={AGREEMENTS_TITLE}
      empty={
        items.length === 0
          ? "No agreement yet. Draft one when the client asks for a service."
          : null
      }
    >
      {items.map((agreement) => (
        <AgreementCard key={agreement.id} agreement={agreement} enquiryId={enquiryId} />
      ))}
      <CreateToggle label="New agreement">
        {(done) => (
          <AgreementCreateForm enquiryId={enquiryId} accountId={accountId} onDone={done} />
        )}
      </CreateToggle>
    </SectionShell>
  );
}

/** The versioned proposals, as staff see them: the internal total, the derived margin and every line. */
export function ProposalsSection({ enquiryId }: { readonly enquiryId: string }) {
  const proposals = useStaffProposals(enquiryId);
  if (proposals.isPending)
    return <SectionSkeleton title={PROPOSALS_TITLE} testID="proposals-loading" />;
  if (proposals.isError)
    return (
      <SectionError
        title={PROPOSALS_TITLE}
        error={proposals.error}
        onRetry={() => void proposals.refetch()}
      />
    );
  const { items } = proposals.data;
  return (
    <SectionShell
      title={PROPOSALS_TITLE}
      empty={items.length === 0 ? "No proposal yet. Draft one once the hotel has quoted." : null}
    >
      {items.map((proposal) => (
        <ProposalCard key={proposal.id} proposal={proposal} enquiryId={enquiryId} />
      ))}
      <CreateToggle label="New proposal">
        {(done) => <ProposalCreateForm enquiryId={enquiryId} onDone={done} />}
      </CreateToggle>
    </SectionShell>
  );
}
