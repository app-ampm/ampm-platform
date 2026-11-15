import { useRef, useState } from "react";

import { InternalPanel } from "@ampm/ui";

import { AmountInput, DateInput } from "./consultancy-admin.form-widgets";
import {
  EMPTY_TOTALS,
  emptyLine,
  type LineDraft,
  type LinePatch,
  type TotalsDraft,
} from "./proposal-draft";
import { LinesEditor } from "./proposal-lines-editor";

export interface ProposalDraftState {
  readonly lines: {
    readonly items: readonly LineDraft[];
    readonly add: () => void;
    readonly remove: (key: number) => void;
    readonly update: (key: number, patch: LinePatch) => void;
  };
  readonly totals: TotalsDraft;
  readonly setTotal: (patch: Partial<TotalsDraft>) => void;
}

/**
 * The proposal form's text state: the lines (keys unique for the life of the form, so a row keeps its
 * own field state when an earlier one goes) and the totals. A new proposal starts empty; an edit
 * starts from the saved draft.
 */
export function useProposalDraft(
  initial: { readonly totals: TotalsDraft; readonly lines: readonly LineDraft[] } = {
    totals: EMPTY_TOTALS,
    lines: [],
  },
): ProposalDraftState {
  const [lines, setLines] = useState<readonly LineDraft[]>(initial.lines);
  const [totals, setTotals] = useState<TotalsDraft>(initial.totals);
  const nextKey = useRef(initial.lines.length);
  const add = (): void => {
    const key = nextKey.current;
    nextKey.current += 1;
    setLines((prev) => [...prev, emptyLine(key)]);
  };
  const remove = (key: number): void => setLines((prev) => prev.filter((line) => line.key !== key));
  const update = (key: number, patch: LinePatch): void =>
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  const setTotal = (patch: Partial<TotalsDraft>): void =>
    setTotals((prev) => ({ ...prev, ...patch }));
  return { lines: { items: lines, add, remove, update }, totals, setTotal };
}

/**
 * The proposal's fields, shared by the new and the edit forms: the lines, the two totals (A-4) and the
 * valid-until date. The internal total is RESTRICTED-FINANCE, so it is typed inside an InternalPanel
 * (Peacock Night §3), and it is not drawn at all for a reader who cannot see it (`withInternalTotal`).
 */
export function ProposalFields({
  draft,
  disabled,
  withInternalTotal = true,
}: {
  readonly draft: ProposalDraftState;
  readonly disabled: boolean;
  readonly withInternalTotal?: boolean | undefined;
}) {
  const { lines } = draft;
  return (
    <>
      <LinesEditor
        lines={lines.items}
        disabled={disabled}
        onAdd={lines.add}
        onRemove={lines.remove}
        onChange={lines.update}
      />
      <TermsFields draft={draft} withInternalTotal={withInternalTotal} />
    </>
  );
}

/** The two totals (A-4) and the valid-until date. */
function TermsFields({
  draft,
  withInternalTotal,
}: {
  readonly draft: ProposalDraftState;
  readonly withInternalTotal: boolean;
}) {
  const { totals, setTotal } = draft;
  return (
    <>
      <AmountInput
        label="Client total"
        field="client total"
        required
        testID="proposal-client-total"
        value={totals.clientTotal}
        onChangeText={(clientTotal) => setTotal({ clientTotal })}
        placeholder="1850000"
        helpText="What the client pays for the whole offer"
      />
      {withInternalTotal ? <InternalTotalField draft={draft} /> : null}
      <DateInput
        label="Valid until"
        field="valid-until date"
        testID="proposal-valid-until"
        value={totals.validUntil}
        onChangeText={(validUntil) => setTotal({ validUntil })}
        placeholder="2027-01-31"
        helpText="Optional · YYYY-MM-DD"
      />
    </>
  );
}

/** The internal total: RESTRICTED-FINANCE, so typed inside an InternalPanel. */
function InternalTotalField({ draft }: { readonly draft: ProposalDraftState }) {
  return (
    <InternalPanel className="rounded" testID="proposal-form-internal">
      <AmountInput
        label="Internal total"
        field="internal total"
        required
        testID="proposal-internal-total"
        value={draft.totals.internalTotal}
        onChangeText={(internalTotal) => draft.setTotal({ internalTotal })}
        placeholder="1700000"
        helpText="The hotel net or commission basis"
      />
    </InternalPanel>
  );
}
