import { useReviseProposal, useShareProposal } from "@ampm/api-client";
import type { HotelProposalInternalView } from "@ampm/core";
import { Button, Row, useToast } from "@ampm/ui";

import { errorMessage } from "./consultancy-admin.form";

export interface ProposalActionsProps {
  readonly proposal: HotelProposalInternalView;
  readonly enquiryId: string;
  /** Opens this draft in the edit form. */
  readonly onEdit: () => void;
  /** A revision drafted the next version: the section opens it for editing. */
  readonly onRevised: (proposalId: string) => void;
}

/**
 * What staff can do with a version. A draft is edited and then shared: "Edit draft" beside the peacock
 * "Share version N with client" (the confirm on a version, as "Approve version 3"). A shared version is
 * immutable, so changing it is "Revise", which drafts version N+1 from it and opens that draft to edit;
 * when the client has asked for changes, revising is the next step and takes the peacock confirm.
 */
export function ProposalActions(props: ProposalActionsProps) {
  const { status } = props.proposal;
  if (status === "draft") return <DraftActions {...props} />;
  if (status === "shared" || status === "revision_requested") return <ReviseAction {...props} />;
  return null;
}

/** A failed write says why, in the API's words where it gave any. */
function useFailureToast() {
  const toast = useToast();
  return (fallback: string) =>
    (error: unknown): void => {
      toast.show({ title: errorMessage(error, fallback), tone: "danger" });
    };
}

function DraftActions({ proposal, enquiryId, onEdit }: ProposalActionsProps) {
  const toast = useToast();
  const fail = useFailureToast();
  const share = useShareProposal(proposal.id, enquiryId);
  const version = proposal.versionNumber;
  const onShare = (): void =>
    share.mutate(undefined, {
      onSuccess: () =>
        toast.show({ title: `Version ${version} shared with the client`, tone: "success" }),
      onError: fail("Could not share the proposal"),
    });
  return (
    <Row gap={2} justify="end" wrap>
      <Button variant="secondary" icon="edit" disabled={share.isPending} onPress={onEdit}>
        Edit draft
      </Button>
      <Button variant="highlight" icon="send" loading={share.isPending} onPress={onShare}>
        {`Share version ${version} with client`}
      </Button>
    </Row>
  );
}

function ReviseAction({ proposal, enquiryId, onRevised }: ProposalActionsProps) {
  const toast = useToast();
  const fail = useFailureToast();
  const revise = useReviseProposal(proposal.id, enquiryId);
  const onRevise = (): void =>
    revise.mutate(undefined, {
      onSuccess: (created) => {
        toast.show({ title: `Version ${created.versionNumber} drafted`, tone: "success" });
        onRevised(created.id);
      },
      onError: fail("Could not revise the proposal"),
    });
  return (
    <Row gap={2} justify="end" wrap>
      <Button
        variant={proposal.status === "revision_requested" ? "highlight" : "secondary"}
        icon="refresh"
        loading={revise.isPending}
        onPress={onRevise}
      >
        {`Revise as version ${proposal.versionNumber + 1}`}
      </Button>
    </Row>
  );
}
