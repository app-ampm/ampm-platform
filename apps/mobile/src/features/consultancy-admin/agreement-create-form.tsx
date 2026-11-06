import { useState } from "react";

import { useCreateServiceAgreement, useServiceTypes } from "@ampm/api-client";
import type { ServiceFeeStructure } from "@ampm/core";
import { Button, Card, Input, Row, Skeleton, Stack, Text, useToast } from "@ampm/ui";

import { errorMessage, moneyFromRupees } from "./consultancy-admin.form";
import { OptionButtons } from "./consultancy-admin.widgets";

const FEE_STRUCTURE_OPTIONS = [
  { value: "fixed", label: "Fixed" },
  { value: "percentage", label: "Percentage" },
  { value: "milestones", label: "Milestones" },
] as const;

/**
 * Staff drafts a paid-service agreement for the enquiry (SA/SM; HT for hotel services). The service type
 * comes from the catalogue (`/crm/service-types`) and the account is the enquiry's own; the agreement is
 * linked back to the enquiry via `hotelEnquiryId` and starts `draft` (the fee is entered, never defaulted).
 */
export function AgreementCreateForm({
  enquiryId,
  accountId,
  onDone,
}: {
  readonly enquiryId: string;
  readonly accountId: string;
  readonly onDone: () => void;
}) {
  const toast = useToast();
  const serviceTypes = useServiceTypes();
  const create = useCreateServiceAgreement(enquiryId);
  const [serviceTypeId, setServiceTypeId] = useState<string | null>(null);
  const [scope, setScope] = useState("");
  const [fee, setFee] = useState("");
  const [feeStructure, setFeeStructure] = useState<ServiceFeeStructure | null>(null);
  const [terms, setTerms] = useState("");

  const feeValue = moneyFromRupees(fee);
  const ready =
    serviceTypeId !== null && scope.trim().length > 0 && feeValue !== null && feeStructure !== null;

  const submit = (): void => {
    if (!ready || serviceTypeId === null || feeValue === null || feeStructure === null) return;
    if (create.isPending) return;
    create.mutate(
      {
        accountId,
        serviceTypeId,
        hotelEnquiryId: enquiryId,
        scopeText: scope.trim(),
        fee: feeValue,
        feeStructure,
        termsVersion: terms.trim().length > 0 ? terms.trim() : null,
      },
      {
        onSuccess: () => {
          toast.show({ title: "Agreement drafted", tone: "success" });
          onDone();
        },
        onError: (error) =>
          toast.show({
            title: errorMessage(error, "Could not draft the agreement"),
            tone: "danger",
          }),
      },
    );
  };

  return (
    <Card>
      <Stack gap={3}>
        <Text variant="subheading">New service agreement</Text>
        <ServiceTypePicker
          query={serviceTypes}
          selected={serviceTypeId}
          onSelect={setServiceTypeId}
          disabled={create.isPending}
        />
        <Input
          label="Scope"
          value={scope}
          onChangeText={setScope}
          placeholder="Rate negotiation and booking coordination"
          multiline
        />
        <Input
          label="Fee in ₹"
          value={fee}
          onChangeText={setFee}
          placeholder="25000"
          keyboardType="number-pad"
        />
        <Stack gap={1}>
          <Text variant="label">Fee structure</Text>
          <OptionButtons
            options={FEE_STRUCTURE_OPTIONS}
            selected={feeStructure}
            onSelect={setFeeStructure}
            disabled={create.isPending}
          />
        </Stack>
        <Input
          label="Terms version (optional)"
          value={terms}
          onChangeText={setTerms}
          placeholder="2026-11"
          autoCapitalize="none"
        />
        <Row gap={2}>
          <Button fullWidth loading={create.isPending} disabled={!ready} onPress={submit}>
            Draft agreement
          </Button>
          <Button variant="ghost" disabled={create.isPending} onPress={onDone}>
            Cancel
          </Button>
        </Row>
      </Stack>
    </Card>
  );
}

/** The service choice, populated from the catalogue: a loading skeleton, an error line, then the options. */
function ServiceTypePicker({
  query,
  selected,
  onSelect,
  disabled,
}: {
  readonly query: ReturnType<typeof useServiceTypes>;
  readonly selected: string | null;
  readonly onSelect: (value: string) => void;
  readonly disabled: boolean;
}) {
  return (
    <Stack gap={1}>
      <Text variant="label">Service</Text>
      {query.isPending ? (
        <Skeleton className="h-10 w-full" />
      ) : query.isError ? (
        <Text tone="danger" variant="bodySmall">
          Could not load the service catalogue.
        </Text>
      ) : query.data.items.length === 0 ? (
        <Text tone="muted" variant="bodySmall">
          No service types are configured yet.
        </Text>
      ) : (
        <OptionButtons
          options={query.data.items.map((type) => ({ value: type.id, label: type.name }))}
          selected={selected}
          onSelect={onSelect}
          disabled={disabled}
        />
      )}
    </Stack>
  );
}
