import { useState } from "react";

import { useStaffProposals, useStaffServiceAgreements } from "@ampm/api-client";
import type { HotelProposalInternalView } from "@ampm/core";
import { Button, Row, Stack } from "@ampm/ui";

import { SectionError } from "../consultancy/section-error";
import { SectionSkeleton } from "../consultancy/section-skeleton";
import { AgreementCard } from "./agreement-card";
import { AgreementCreateForm } from "./agreement-create-form";
import { isLiveProposal } from "./consultancy-admin.format";
import { CreateToggle } from "./consultancy-admin.widgets";
import { ProposalCard } from "./proposal-card";
import { ProposalCreateForm } from "./proposal-create-form";
import { SectionShell } from "./section-parts";

const AGREEMENTS_TITLE = "Service agreements";
const PROPOSALS_TITLE = "Proposals";
const NO_PROPOSAL = "No proposal yet. Once the hotel has quoted, draft the client's offer.";

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

/**
 * The versioned proposals, as staff see them: the current version first and in full (edited in place
 * while it is a draft), the earlier ones folded under a toggle, newest first. A new proposal can be
 * drafted only while none stands (the API refuses a second; a change is a revision), and a revision
 * opens the version it drafted straight in the edit form.
 */
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
  return <ProposalVersions items={proposals.data.items} enquiryId={enquiryId} />;
}

/** The loaded versions; which one is open in the edit form is this section's own state. */
function ProposalVersions({
  items,
  enquiryId,
}: {
  readonly items: readonly HotelProposalInternalView[];
  readonly enquiryId: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [current, ...earlier] = [...items].sort((a, b) => b.versionNumber - a.versionNumber);
  const canDraftNew = items.every((proposal) => !isLiveProposal(proposal.status));
  return (
    <SectionShell title={PROPOSALS_TITLE} empty={current ? null : NO_PROPOSAL}>
      {current ? (
        <ProposalCard
          proposal={current}
          enquiryId={enquiryId}
          editing={editingId === current.id}
          onEdit={() => setEditingId(current.id)}
          onEditDone={() => setEditingId(null)}
          onRevised={setEditingId}
        />
      ) : null}
      {canDraftNew ? (
        <CreateToggle label={current ? "New proposal" : "Draft a proposal"}>
          {(done) => <ProposalCreateForm enquiryId={enquiryId} onDone={done} />}
        </CreateToggle>
      ) : null}
      <EarlierVersions versions={earlier} enquiryId={enquiryId} />
    </SectionShell>
  );
}

/** The versions before the current one, folded until asked for: they are history, not the work. */
function EarlierVersions({
  versions,
  enquiryId,
}: {
  readonly versions: readonly HotelProposalInternalView[];
  readonly enquiryId: string;
}) {
  const [open, setOpen] = useState(false);
  if (versions.length === 0) return null;
  const count = versions.length;
  return (
    <Stack gap={3}>
      <Row justify="start">
        <Button
          variant="ghost"
          size="sm"
          icon={open ? "chevron-up" : "chevron-down"}
          aria-expanded={open}
          onPress={() => setOpen((shown) => !shown)}
          testID="proposals-earlier-toggle"
        >
          {`${open ? "Hide" : "Show"} ${count} earlier ${count === 1 ? "version" : "versions"}`}
        </Button>
      </Row>
      {open
        ? versions.map((proposal) => (
            <ProposalCard key={proposal.id} proposal={proposal} enquiryId={enquiryId} />
          ))
        : null}
    </Stack>
  );
}
