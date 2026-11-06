import { useState } from "react";

import { useCreateProposal } from "@ampm/api-client";
import type { HotelProposalLineInput, HotelRateItemType } from "@ampm/core";
import { Button, Card, Input, Row, Stack, Text, useToast } from "@ampm/ui";

import {
  errorMessage,
  isIsoDate,
  moneyFromRupees,
  RATE_ITEM_OPTIONS,
} from "./consultancy-admin.form";
import { OptionButtons } from "./consultancy-admin.widgets";

/** One line of the proposal as the form holds it: all text until it is parsed on submit. */
interface LineDraft {
  readonly itemType: HotelRateItemType | null;
  readonly description: string;
  readonly quantity: string;
  readonly unitAmount: string;
  readonly totalAmount: string;
  // null until the staff member explicitly chooses: a line must not be submittable with an
  // unconsidered visibility (fail closed, security.md) — the client view carries client-visible lines.
  readonly clientVisible: boolean | null;
}

function emptyLine(): LineDraft {
  return {
    itemType: null,
    description: "",
    quantity: "",
    unitAmount: "",
    totalAmount: "",
    clientVisible: null,
  };
}

/** Parse a line draft to the wire input, or null when any field is missing or out of range. */
function lineToInput(draft: LineDraft): HotelProposalLineInput | null {
  const description = draft.description.trim();
  const quantity = Number(draft.quantity.replace(/[,\s]/g, ""));
  const unitAmount = moneyFromRupees(draft.unitAmount);
  const totalAmount = moneyFromRupees(draft.totalAmount);
  if (draft.itemType === null || description.length === 0 || draft.clientVisible === null)
    return null;
  if (!Number.isFinite(quantity) || quantity <= 0 || !unitAmount || !totalAmount) return null;
  return {
    itemType: draft.itemType,
    description,
    quantity,
    unitAmount,
    totalAmount,
    clientVisible: draft.clientVisible,
  };
}

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
  const [validUntil, setValidUntil] = useState("");
  const [clientTotal, setClientTotal] = useState("");
  const [internalTotal, setInternalTotal] = useState("");
  const [lines, setLines] = useState<readonly LineDraft[]>([]);

  const clientTotalValue = moneyFromRupees(clientTotal);
  const internalTotalValue = moneyFromRupees(internalTotal);
  const lineInputs = lines.map(lineToInput);
  const ready =
    clientTotalValue !== null &&
    internalTotalValue !== null &&
    (validUntil.trim() === "" || isIsoDate(validUntil.trim())) &&
    lineInputs.every((line) => line !== null);

  const updateLine = (index: number, patch: Partial<LineDraft>): void =>
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  const submit = (): void => {
    if (!ready || clientTotalValue === null || internalTotalValue === null || create.isPending)
      return;
    create.mutate(
      {
        enquiryId,
        validUntil: validUntil.trim() === "" ? null : validUntil.trim(),
        clientTotal: clientTotalValue,
        internalTotal: internalTotalValue,
        lines: lineInputs.filter((line): line is HotelProposalLineInput => line !== null),
      },
      {
        onSuccess: () => {
          toast.show({ title: "Proposal drafted", tone: "success" });
          onDone();
        },
        onError: (error) =>
          toast.show({
            title: errorMessage(error, "Could not draft the proposal"),
            tone: "danger",
          }),
      },
    );
  };

  return (
    <Card>
      <Stack gap={3}>
        <Text variant="subheading">New proposal</Text>
        <TotalsFields
          validUntil={validUntil}
          onValidUntil={setValidUntil}
          clientTotal={clientTotal}
          onClientTotal={setClientTotal}
          internalTotal={internalTotal}
          onInternalTotal={setInternalTotal}
        />
        <LinesEditor
          lines={lines}
          disabled={create.isPending}
          onAdd={() => setLines((prev) => [...prev, emptyLine()])}
          onRemove={(index) => setLines((prev) => prev.filter((_, i) => i !== index))}
          onChange={updateLine}
        />
        <Row gap={2}>
          <Button fullWidth loading={create.isPending} disabled={!ready} onPress={submit}>
            Draft proposal
          </Button>
          <Button variant="ghost" disabled={create.isPending} onPress={onDone}>
            Cancel
          </Button>
        </Row>
      </Stack>
    </Card>
  );
}

function TotalsFields({
  validUntil,
  onValidUntil,
  clientTotal,
  onClientTotal,
  internalTotal,
  onInternalTotal,
}: {
  readonly validUntil: string;
  readonly onValidUntil: (value: string) => void;
  readonly clientTotal: string;
  readonly onClientTotal: (value: string) => void;
  readonly internalTotal: string;
  readonly onInternalTotal: (value: string) => void;
}) {
  return (
    <>
      <Input
        label="Client total in ₹"
        value={clientTotal}
        onChangeText={onClientTotal}
        placeholder="1850000"
        keyboardType="number-pad"
      />
      <Input
        label="Internal total in ₹ (not shown to the client)"
        value={internalTotal}
        onChangeText={onInternalTotal}
        placeholder="1700000"
        keyboardType="number-pad"
      />
      <Input
        label="Valid until (YYYY-MM-DD, optional)"
        value={validUntil}
        onChangeText={onValidUntil}
        placeholder="2027-01-31"
        autoCapitalize="none"
      />
    </>
  );
}

function LinesEditor({
  lines,
  disabled,
  onAdd,
  onRemove,
  onChange,
}: {
  readonly lines: readonly LineDraft[];
  readonly disabled: boolean;
  readonly onAdd: () => void;
  readonly onRemove: (index: number) => void;
  readonly onChange: (index: number, patch: Partial<LineDraft>) => void;
}) {
  return (
    <Stack gap={2}>
      <Text variant="label" tone="muted">
        Lines (optional)
      </Text>
      {lines.map((line, index) => (
        <LineRow
          key={index}
          line={line}
          disabled={disabled}
          onRemove={() => onRemove(index)}
          onChange={(patch) => onChange(index, patch)}
        />
      ))}
      <Row justify="start">
        <Button variant="secondary" size="sm" disabled={disabled} onPress={onAdd}>
          Add line
        </Button>
      </Row>
    </Stack>
  );
}

function LineRow({
  line,
  disabled,
  onRemove,
  onChange,
}: {
  readonly line: LineDraft;
  readonly disabled: boolean;
  readonly onRemove: () => void;
  readonly onChange: (patch: Partial<LineDraft>) => void;
}) {
  return (
    <Card>
      <Stack gap={2}>
        <OptionButtons
          options={RATE_ITEM_OPTIONS}
          selected={line.itemType}
          onSelect={(itemType) => onChange({ itemType })}
          disabled={disabled}
        />
        <Input
          label="Description"
          value={line.description}
          onChangeText={(description) => onChange({ description })}
          placeholder="Deluxe rooms, 2 nights"
        />
        <Row gap={2}>
          <Input
            label="Qty"
            className="flex-1"
            value={line.quantity}
            onChangeText={(quantity) => onChange({ quantity })}
            placeholder="60"
            keyboardType="number-pad"
          />
          <Input
            label="Unit ₹"
            className="flex-1"
            value={line.unitAmount}
            onChangeText={(unitAmount) => onChange({ unitAmount })}
            placeholder="12000"
            keyboardType="number-pad"
          />
          <Input
            label="Total ₹"
            className="flex-1"
            value={line.totalAmount}
            onChangeText={(totalAmount) => onChange({ totalAmount })}
            placeholder="720000"
            keyboardType="number-pad"
          />
        </Row>
        <OptionButtons
          options={[
            { value: "client", label: "Client sees it" },
            { value: "internal", label: "Internal only" },
          ]}
          selected={line.clientVisible === null ? null : line.clientVisible ? "client" : "internal"}
          onSelect={(value) => onChange({ clientVisible: value === "client" })}
          disabled={disabled}
        />
        <Row justify="start">
          <Button variant="ghost" size="sm" disabled={disabled} onPress={onRemove}>
            Remove line
          </Button>
        </Row>
      </Stack>
    </Card>
  );
}
