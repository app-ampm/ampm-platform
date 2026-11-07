import { useState } from "react";

import { useCreateServiceAgreement, useServiceTypes } from "@ampm/api-client";
import type { ServiceAgreementCreateRequest, ServiceFeeStructure } from "@ampm/core";
import { Skeleton, Stack, Text, useToast } from "@ampm/ui";

import {
  errorMessage,
  FEE_STRUCTURE_OPTIONS,
  moneyFromRupees,
  textError,
} from "./consultancy-admin.form";
import {
  AmountInput,
  ChoiceChips,
  ChoiceSegments,
  FormCard,
  FormInput,
} from "./consultancy-admin.form-widgets";

interface AgreementDraft {
  readonly serviceTypeId: string | null;
  readonly scope: string;
  readonly fee: string;
  readonly feeStructure: ServiceFeeStructure | null;
  readonly terms: string;
}

const EMPTY_DRAFT: AgreementDraft = {
  serviceTypeId: null,
  scope: "",
  fee: "",
  feeStructure: null,
  terms: "",
};

/** The create request when the service, scope, fee and fee structure are all given, else null. */
function agreementRequest(
  draft: AgreementDraft,
  enquiryId: string,
  accountId: string,
): ServiceAgreementCreateRequest | null {
  const fee = moneyFromRupees(draft.fee);
  const scopeText = draft.scope.trim();
  const terms = draft.terms.trim();
  if (draft.serviceTypeId === null || draft.feeStructure === null) return null;
  if (scopeText.length === 0 || fee === null) return null;
  return {
    accountId,
    serviceTypeId: draft.serviceTypeId,
    hotelEnquiryId: enquiryId,
    scopeText,
    fee,
    feeStructure: draft.feeStructure,
    termsVersion: terms.length > 0 ? terms : null,
  };
}

function useAgreementForm(enquiryId: string, accountId: string, onDone: () => void) {
  const toast = useToast();
  const create = useCreateServiceAgreement(enquiryId);
  const [draft, setDraft] = useState<AgreementDraft>(EMPTY_DRAFT);
  const request = agreementRequest(draft, enquiryId, accountId);
  const submit = (): void => {
    if (request === null || create.isPending) return;
    create.mutate(request, {
      onSuccess: () => {
        toast.show({ title: "Agreement drafted", tone: "success" });
        onDone();
      },
      onError: (error) =>
        toast.show({ title: errorMessage(error, "Could not draft the agreement"), tone: "danger" }),
    });
  };
  const set = (patch: Partial<AgreementDraft>): void => setDraft((prev) => ({ ...prev, ...patch }));
  return { draft, set, ready: request !== null, pending: create.isPending, submit };
}

/**
 * Staff drafts a paid-service agreement for the enquiry (SA/SM; HT for hotel services). The service type
 * comes from the catalogue (`/crm/service-types`) and the account is the enquiry's own; the agreement is
 * linked back to the enquiry via `hotelEnquiryId` and starts `draft` (the fee is entered, never defaulted).
 * The fee is what the client pays, a client amount: no internal figure is typed here.
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
  const { draft, set, ready, pending, submit } = useAgreementForm(enquiryId, accountId, onDone);
  return (
    <FormCard
      title="New service agreement"
      description="It starts as a draft; send it to the client from its card."
      submitLabel="Draft agreement"
      ready={ready}
      pending={pending}
      onSubmit={submit}
      onCancel={onDone}
      testID="agreement-create-form"
    >
      <ServiceTypePicker
        selected={draft.serviceTypeId}
        onSelect={(serviceTypeId) => set({ serviceTypeId })}
        disabled={pending}
      />
      <ScopeAndFeeFields draft={draft} set={set} pending={pending} />
      <StructureAndTermsFields draft={draft} set={set} pending={pending} />
    </FormCard>
  );
}

interface AgreementFieldsProps {
  readonly draft: AgreementDraft;
  readonly set: (patch: Partial<AgreementDraft>) => void;
  readonly pending: boolean;
}

/** What the service covers and the fee the client pays for it (a client amount). */
function ScopeAndFeeFields({ draft, set }: AgreementFieldsProps) {
  return (
    <>
      <FormInput
        label="Scope"
        required
        multiline
        testID="agreement-scope"
        value={draft.scope}
        onChangeText={(scope) => set({ scope })}
        placeholder="Rate negotiation and booking coordination"
        error={textError(draft.scope, "Describe the scope of the service")}
      />
      <AmountInput
        label="Fee"
        field="fee"
        required
        testID="agreement-fee"
        value={draft.fee}
        onChangeText={(fee) => set({ fee })}
        placeholder="25000"
        helpText="What the client pays for this service"
      />
    </>
  );
}

/** How the fee is charged (chosen on purpose, never defaulted) and the optional terms version. */
function StructureAndTermsFields({ draft, set, pending }: AgreementFieldsProps) {
  return (
    <>
      <ChoiceSegments
        label="Fee structure"
        required
        onPhone="scroll"
        options={FEE_STRUCTURE_OPTIONS}
        selected={draft.feeStructure}
        onSelect={(feeStructure) => set({ feeStructure })}
        disabled={pending}
        testID="agreement-fee-structure"
      />
      <FormInput
        label="Terms version"
        testID="agreement-terms"
        value={draft.terms}
        onChangeText={(terms) => set({ terms })}
        placeholder="2026-11"
        autoCapitalize="none"
        helpText="Optional"
      />
    </>
  );
}

/** The service choice, populated from the catalogue: a loading skeleton, an error line, then the options. */
function ServiceTypePicker({
  selected,
  onSelect,
  disabled,
}: {
  readonly selected: string | null;
  readonly onSelect: (value: string) => void;
  readonly disabled: boolean;
}) {
  const query = useServiceTypes();
  if (query.isPending || query.isError || query.data.items.length === 0) {
    return (
      <Stack gap={2}>
        <Text variant="label" tone="body">
          Service
        </Text>
        {query.isPending ? (
          <Skeleton shape="text" className="h-10 w-full" testID="service-types-loading" />
        ) : (
          <Text variant="bodySmall" tone={query.isError ? "brand" : "muted"}>
            {query.isError
              ? "Could not load the service catalogue."
              : "No service types are configured yet."}
          </Text>
        )}
      </Stack>
    );
  }
  return (
    <ChoiceChips
      label="Service"
      required
      options={query.data.items.map((type) => ({ value: type.id, label: type.name }))}
      selected={selected}
      onSelect={onSelect}
      disabled={disabled}
      testID="agreement-service"
    />
  );
}
