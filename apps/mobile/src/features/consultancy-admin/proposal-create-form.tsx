import { useRef, useState } from "react";

import { useCreateProposal } from "@ampm/api-client";
import { InternalPanel, useToast } from "@ampm/ui";

import { errorMessage } from "./consultancy-admin.form";
import { AmountInput, DateInput, FormCard } from "./consultancy-admin.form-widgets";
import {
  EMPTY_TOTALS,
  emptyLine,
  proposalRequest,
  type LineDraft,
  type LinePatch,
  type TotalsDraft,
} from "./proposal-draft";
import { LinesEditor } from "./proposal-lines-editor";

/** The line drafts and the three ways to change them; keys stay unique for the life of the form. */
function useLineDrafts() {
  const [lines, setLines] = useState<readonly LineDraft[]>([]);
  const nextKey = useRef(0);
  const add = (): void => {
    const key = nextKey.current;
    nextKey.current += 1;
    setLines((prev) => [...prev, emptyLine(key)]);
  };
  const remove = (key: number): void => setLines((prev) => prev.filter((line) => line.key !== key));
  const update = (key: number, patch: LinePatch): void =>
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  return { items: lines, add, remove, update };
}

function useProposalForm(enquiryId: string, onDone: () => void) {
  const toast = useToast();
  const create = useCreateProposal(enquiryId);
  const lines = useLineDrafts();
  const [totals, setTotals] = useState<TotalsDraft>(EMPTY_TOTALS);
  const request = proposalRequest(enquiryId, totals, lines.items);
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
  const setTotal = (patch: Partial<TotalsDraft>): void =>
    setTotals((prev) => ({ ...prev, ...patch }));
  return { lines, totals, setTotal, ready: request !== null, pending: create.isPending, submit };
}

/**
 * Staff drafts a new proposal (SA/HT). Both the client total and the internal total are entered (A-4) —
 * the margin is derived server-side, never typed here. Lines are optional; each carries its own
 * client-visible flag, so an internal-only line never reaches the client view. Starts version 1, `draft`.
 * The internal total is RESTRICTED-FINANCE, so it is typed inside an InternalPanel (Peacock Night §3).
 */
export function ProposalCreateForm({
  enquiryId,
  onDone,
}: {
  readonly enquiryId: string;
  readonly onDone: () => void;
}) {
  const form = useProposalForm(enquiryId, onDone);
  return (
    <FormCard
      title="New proposal"
      description="It starts as a draft. Enter both totals; the margin is worked out from them."
      submitLabel="Draft proposal"
      ready={form.ready}
      pending={form.pending}
      onSubmit={form.submit}
      onCancel={onDone}
      testID="proposal-create-form"
    >
      <LinesEditor
        lines={form.lines.items}
        disabled={form.pending}
        onAdd={form.lines.add}
        onRemove={form.lines.remove}
        onChange={form.lines.update}
      />
      <TotalsFields totals={form.totals} onChange={form.setTotal} />
      <ValidUntilField totals={form.totals} onChange={form.setTotal} />
    </FormCard>
  );
}

interface TotalsFieldsProps {
  readonly totals: TotalsDraft;
  readonly onChange: (patch: Partial<TotalsDraft>) => void;
}

/** The two totals (A-4): what the client pays, and the internal total inside an InternalPanel. */
function TotalsFields({ totals, onChange }: TotalsFieldsProps) {
  return (
    <>
      <AmountInput
        label="Client total"
        field="client total"
        required
        testID="proposal-client-total"
        value={totals.clientTotal}
        onChangeText={(clientTotal) => onChange({ clientTotal })}
        placeholder="1850000"
        helpText="What the client pays for the whole offer"
      />
      <InternalPanel className="rounded" testID="proposal-form-internal">
        <AmountInput
          label="Internal total"
          field="internal total"
          required
          testID="proposal-internal-total"
          value={totals.internalTotal}
          onChangeText={(internalTotal) => onChange({ internalTotal })}
          placeholder="1700000"
          helpText="The hotel net or commission basis"
        />
      </InternalPanel>
    </>
  );
}

function ValidUntilField({ totals, onChange }: TotalsFieldsProps) {
  return (
    <DateInput
      label="Valid until"
      field="valid-until date"
      testID="proposal-valid-until"
      value={totals.validUntil}
      onChangeText={(validUntil) => onChange({ validUntil })}
      placeholder="2027-01-31"
      helpText="Optional · YYYY-MM-DD"
    />
  );
}
