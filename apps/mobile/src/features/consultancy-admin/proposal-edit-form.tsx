import { useUpdateProposal } from "@ampm/api-client";
import type { HotelProposalInternalView } from "@ampm/core";
import { useToast } from "@ampm/ui";

import { errorMessage } from "./consultancy-admin.form";
import { FormCard } from "./consultancy-admin.form-widgets";
import { draftFromProposal, proposalUpdateRequest } from "./proposal-draft";
import { ProposalFields, useProposalDraft } from "./proposal-form-fields";

/**
 * Staff edits a DRAFT proposal in place (SA/HT): the same fields as a new one, opened on the saved
 * version's totals, date and lines. Saving replaces the draft's terms and its whole line set; sharing
 * stays a separate step on the card. A shared version is never edited — the API 409s, and the card
 * offers "Revise" instead, which drafts the next version to edit here.
 */
export function ProposalEditForm({
  proposal,
  enquiryId,
  onDone,
}: {
  readonly proposal: HotelProposalInternalView;
  readonly enquiryId: string;
  readonly onDone: () => void;
}) {
  const form = useProposalEdit(proposal, enquiryId, onDone);
  return (
    <FormCard
      title={`Edit version ${proposal.versionNumber}`}
      description="Still a draft: the client sees nothing until you share it."
      submitLabel="Save changes"
      ready={form.ready}
      pending={form.pending}
      onSubmit={form.submit}
      onCancel={onDone}
      testID={`proposal-edit-form-${proposal.id}`}
    >
      <ProposalFields
        draft={form.draft}
        disabled={form.pending}
        withInternalTotal={form.withInternalTotal}
      />
    </FormCard>
  );
}

/** The edit form's state, opened on the saved draft, and its save. */
function useProposalEdit(
  proposal: HotelProposalInternalView,
  enquiryId: string,
  onDone: () => void,
) {
  const toast = useToast();
  const update = useUpdateProposal(proposal.id, enquiryId);
  const draft = useProposalDraft(draftFromProposal(proposal));
  // The internal total is the reader's to edit only if the API showed it to them.
  const withInternalTotal = proposal.internalTotal !== undefined;
  const request = proposalUpdateRequest(draft.totals, draft.lines.items, withInternalTotal);
  const submit = (): void => {
    if (request === null || update.isPending) return;
    update.mutate(request, {
      onSuccess: () => {
        toast.show({ title: `Version ${proposal.versionNumber} saved`, tone: "success" });
        onDone();
      },
      onError: (error) =>
        toast.show({ title: errorMessage(error, "Could not save the proposal"), tone: "danger" }),
    });
  };
  return { draft, withInternalTotal, ready: request !== null, pending: update.isPending, submit };
}
