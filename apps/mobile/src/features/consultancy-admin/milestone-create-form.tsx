import { useState } from "react";

import { useCreateBookingMilestone } from "@ampm/api-client";
import type { BookingMilestoneCreateRequest, BookingMilestoneType } from "@ampm/core";
import { useToast } from "@ampm/ui";

import {
  errorMessage,
  isIsoDate,
  isoDateTimeFromDate,
  MILESTONE_TYPE_OPTIONS,
  moneyFromRupees,
} from "./consultancy-admin.form";
import { AmountInput, ChoiceChips, DateInput, FormCard } from "./consultancy-admin.form-widgets";

interface MilestoneDraft {
  readonly type: BookingMilestoneType | null;
  readonly due: string;
  readonly amount: string;
}

/** The create request once a type is chosen and any due date or amount typed parses, else null. */
function milestoneRequest(
  draft: MilestoneDraft,
  enquiryId: string,
): BookingMilestoneCreateRequest | null {
  const due = draft.due.trim();
  const amountText = draft.amount.trim();
  const amount = amountText.length > 0 ? moneyFromRupees(amountText) : null;
  if (draft.type === null) return null;
  if (due.length > 0 && !isIsoDate(due)) return null;
  if (amountText.length > 0 && amount === null) return null;
  return {
    enquiryId,
    milestoneType: draft.type,
    dueAt: due.length > 0 ? isoDateTimeFromDate(due) : null,
    amount,
    contractId: null,
    documentId: null,
  };
}

function useMilestoneForm(enquiryId: string, onDone: () => void) {
  const toast = useToast();
  const create = useCreateBookingMilestone(enquiryId);
  const [draft, setDraft] = useState<MilestoneDraft>({ type: null, due: "", amount: "" });
  const request = milestoneRequest(draft, enquiryId);
  const submit = (): void => {
    if (request === null || create.isPending) return;
    create.mutate(request, {
      onSuccess: () => {
        toast.show({ title: "Milestone added", tone: "success" });
        onDone();
      },
      onError: (error) =>
        toast.show({ title: errorMessage(error, "Could not add the milestone"), tone: "danger" }),
    });
  };
  const set = (patch: Partial<MilestoneDraft>): void => setDraft((prev) => ({ ...prev, ...patch }));
  return { draft, set, ready: request !== null, pending: create.isPending, submit };
}

/**
 * Staff adds a booking milestone to the enquiry (SA/HT). The type is fixed at creation; the due date and
 * amount are optional. A `contract_signed` milestone with a document is what the confirmed-guard reads
 * (AC-05.6), but attaching a document needs the Module N upload service, so it is left for later here.
 */
export function MilestoneCreateForm({
  enquiryId,
  onDone,
}: {
  readonly enquiryId: string;
  readonly onDone: () => void;
}) {
  const { draft, set, ready, pending, submit } = useMilestoneForm(enquiryId, onDone);
  return (
    <FormCard
      title="New milestone"
      description="The type is fixed once it is added; the due date and amount are optional."
      submitLabel="Add milestone"
      ready={ready}
      pending={pending}
      onSubmit={submit}
      onCancel={onDone}
      testID="milestone-create-form"
    >
      <MilestoneFields draft={draft} set={set} pending={pending} />
    </FormCard>
  );
}

interface MilestoneFieldsProps {
  readonly draft: MilestoneDraft;
  readonly set: (patch: Partial<MilestoneDraft>) => void;
  readonly pending: boolean;
}

/** The kind (fixed once added), then the optional due date and amount. */
function MilestoneFields({ draft, set, pending }: MilestoneFieldsProps) {
  return (
    <>
      <ChoiceChips
        label="Type"
        required
        options={MILESTONE_TYPE_OPTIONS}
        selected={draft.type}
        onSelect={(type) => set({ type })}
        disabled={pending}
        testID="milestone-type"
      />
      <DateInput
        label="Due date"
        field="due date"
        testID="milestone-due"
        value={draft.due}
        onChangeText={(due) => set({ due })}
        placeholder="2027-01-31"
        helpText="Optional · YYYY-MM-DD"
      />
      <AmountInput
        label="Amount"
        field="amount"
        testID="milestone-amount"
        value={draft.amount}
        onChangeText={(amount) => set({ amount })}
        placeholder="250000"
        helpText="Optional"
      />
    </>
  );
}
