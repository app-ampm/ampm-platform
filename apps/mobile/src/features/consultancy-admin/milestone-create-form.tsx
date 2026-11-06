import { useState } from "react";

import { useCreateBookingMilestone } from "@ampm/api-client";
import type { BookingMilestoneType } from "@ampm/core";
import { Button, Card, Input, Row, Stack, Text, useToast } from "@ampm/ui";

import {
  errorMessage,
  isIsoDate,
  isoDateTimeFromDate,
  MILESTONE_TYPE_OPTIONS,
  moneyFromRupees,
} from "./consultancy-admin.form";
import { OptionButtons } from "./consultancy-admin.widgets";

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
  const toast = useToast();
  const create = useCreateBookingMilestone(enquiryId);
  const [type, setType] = useState<BookingMilestoneType | null>(null);
  const [due, setDue] = useState("");
  const [amount, setAmount] = useState("");

  const amountEntered = amount.trim().length > 0;
  const amountValue = amountEntered ? moneyFromRupees(amount.trim()) : null;
  const dueEntered = due.trim().length > 0;
  const ready =
    type !== null &&
    (!dueEntered || isIsoDate(due.trim())) &&
    (!amountEntered || amountValue !== null);

  const submit = (): void => {
    if (!ready || type === null || create.isPending) return;
    create.mutate(
      {
        enquiryId,
        milestoneType: type,
        dueAt: dueEntered ? isoDateTimeFromDate(due.trim()) : null,
        amount: amountValue,
        contractId: null,
        documentId: null,
      },
      {
        onSuccess: () => {
          toast.show({ title: "Milestone added", tone: "success" });
          onDone();
        },
        onError: (error) =>
          toast.show({ title: errorMessage(error, "Could not add the milestone"), tone: "danger" }),
      },
    );
  };

  return (
    <Card>
      <Stack gap={3}>
        <Text variant="subheading">New milestone</Text>
        <Stack gap={1}>
          <Text variant="label">Type</Text>
          <OptionButtons
            options={MILESTONE_TYPE_OPTIONS}
            selected={type}
            onSelect={setType}
            disabled={create.isPending}
          />
        </Stack>
        <Input
          label="Due date (YYYY-MM-DD, optional)"
          value={due}
          onChangeText={setDue}
          placeholder="2027-01-31"
          autoCapitalize="none"
        />
        <Input
          label="Amount in ₹ (optional)"
          value={amount}
          onChangeText={setAmount}
          placeholder="250000"
          keyboardType="number-pad"
        />
        <Row gap={2}>
          <Button fullWidth loading={create.isPending} disabled={!ready} onPress={submit}>
            Add milestone
          </Button>
          <Button variant="ghost" disabled={create.isPending} onPress={onDone}>
            Cancel
          </Button>
        </Row>
      </Stack>
    </Card>
  );
}
