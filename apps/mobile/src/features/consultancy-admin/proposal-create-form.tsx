import { useCreateProposal } from "@ampm/api-client";
import { useToast } from "@ampm/ui";

import { errorMessage } from "./consultancy-admin.form";
import { FormCard } from "./consultancy-admin.form-widgets";
import { proposalRequest } from "./proposal-draft";
import { ProposalFields, useProposalDraft } from "./proposal-form-fields";

/**
 * Staff drafts a new proposal (SA/HT). Both the client total and the internal total are entered (A-4) —
 * the margin is derived server-side, never typed here. Lines are optional; each carries its own
 * client-visible flag, so an internal-only line never reaches the client view. Starts version 1, `draft`.
 */
export function ProposalCreateForm({
  enquiryId,
  onDone,
}: {
  readonly enquiryId: string;
  readonly onDone: () => void;
}) {
  const toast = useToast();
  const create = useCreateProposal(enquiryId);
  const draft = useProposalDraft();
  const request = proposalRequest(enquiryId, draft.totals, draft.lines.items);
  const submit = (): void => {
    if (request === null || create.isPending) return;
    create.mutate(request, {
      onSuccess: () => {
        toast.show({ title: "Proposal drafted", tone: "success" });
        onDone();
      },
      onError: (error) =>
        toast.show({ title: errorMessage(error, "Could not draft the proposal"), tone: "danger" }),
    });
  };
  return (
    <FormCard
      title="New proposal"
      description="It starts as a draft. Enter both totals; the margin is worked out from them."
      submitLabel="Draft proposal"
      ready={request !== null}
      pending={create.isPending}
      onSubmit={submit}
      onCancel={onDone}
      testID="proposal-create-form"
    >
      <ProposalFields draft={draft} disabled={create.isPending} />
    </FormCard>
  );
}
