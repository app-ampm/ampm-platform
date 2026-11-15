import { useState } from "react";

import { useAcceptServiceAgreement } from "@ampm/api-client";
import {
  clientAmount,
  type ServiceAgreementClientView,
  type ServiceFeeStructure,
} from "@ampm/core";
import {
  Button,
  Callout,
  Card,
  Checkbox,
  MoneyText,
  Row,
  Stack,
  StatusChip,
  Text,
  useToast,
} from "@ampm/ui";

import { agreementBadge } from "./consultancy.format";
import { useInDetailPanel } from "./enquiry-surface";

const FEE_STRUCTURE: Record<ServiceFeeStructure, string> = {
  fixed: "Fixed fee",
  percentage: "Percentage fee",
  milestones: "Paid in milestones",
};

/** The API's words for a refused accept (they say why), else the fallback. */
function reason(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}

/**
 * Accepting a `sent` agreement (feature 10.2: "client accepts in-app, terms checkbox"): the client ticks
 * that they agree to the scope, fee and terms before the button does anything, and that tick is the
 * explicit consent the API records (`termsAccepted`, security.md). Accepting is a confirmation, so its
 * button is peacock (highlight): the screen's one gold action stays the proposal's "Accept proposal".
 */
function AcceptAgreement({ agreement }: { readonly agreement: ServiceAgreementClientView }) {
  const toast = useToast();
  const accept = useAcceptServiceAgreement(agreement.id);
  const inPanel = useInDetailPanel();
  const [agreed, setAgreed] = useState(false);
  const terms = agreement.termsVersion ? ` (terms ${agreement.termsVersion})` : "";
  const onAccept = (): void =>
    accept.mutate(
      { termsAccepted: true },
      {
        onError: (error) =>
          toast.show({ title: reason(error, "Could not accept the agreement"), tone: "danger" }),
      },
    );
  return (
    <Stack gap={3}>
      <Checkbox
        checked={agreed}
        onCheckedChange={setAgreed}
        label={`I agree to this scope, the fee and AMPM's terms${terms}`}
        disabled={accept.isPending}
        testID="agreement-terms"
      />
      <Button
        variant="highlight"
        fullWidth={!inPanel}
        disabled={!agreed}
        loading={accept.isPending}
        onPress={onAccept}
      >
        Accept agreement
      </Button>
    </Stack>
  );
}

/** What the client can do with the agreement, or where it stands once accepted. */
function AgreementAction({ agreement }: { readonly agreement: ServiceAgreementClientView }) {
  if (agreement.status === "sent") return <AcceptAgreement agreement={agreement} />;
  if (agreement.status === "accepted")
    return (
      <Callout
        kind="awaiting-confirmation"
        title="Accepted. AMPM will activate it shortly."
        blur={false}
      />
    );
  if (agreement.status === "active")
    return <Callout kind="success" title="Active. AMPM is working on it." blur={false} />;
  return null;
}

/** The agreement's service, scope and fee, and what the client can do with it. */
export function ClientAgreementCard({
  agreement,
}: {
  readonly agreement: ServiceAgreementClientView;
}) {
  const badge = agreementBadge[agreement.status];
  const inPanel = useInDetailPanel();
  return (
    <Card
      padding="lg"
      tone={inPanel ? "flat" : "glass"}
      testID={`client-agreement-${agreement.id}`}
    >
      <Stack gap={3.5}>
        <Row gap={3} justify="between" align="start">
          <Text variant="heading" className="flex-1">
            {agreement.serviceName}
          </Text>
          <StatusChip label={badge.label} tone={badge.tone} size="sm" />
        </Row>
        <Text>{agreement.scopeText}</Text>
        <Stack gap={1}>
          <Text variant="eyebrow">{FEE_STRUCTURE[agreement.feeStructure]}</Text>
          <MoneyText
            amount={clientAmount(agreement.fee.minor, agreement.fee.currency)}
            variant="subheading"
          />
        </Stack>
        <AgreementAction agreement={agreement} />
      </Stack>
    </Card>
  );
}
