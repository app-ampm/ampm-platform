import { useTransitionServiceAgreement } from "@ampm/api-client";
import {
  clientAmount,
  type ServiceAgreementStaffView,
  type ServiceAgreementStatus,
} from "@ampm/core";
import { Card, MoneyText, Row, Stack, Text, useToast } from "@ampm/ui";

import { feeStructureLabel } from "./consultancy-admin.form";
import { staffAgreementBadge } from "./consultancy-admin.format";
import { RecordHeader } from "./section-parts";
import { TransitionRow } from "./transition-row";
import { useSectionCard } from "./use-section-card";

const AGREEMENT_NEXT: Record<ServiceAgreementStatus, readonly ServiceAgreementStatus[]> = {
  draft: ["sent", "cancelled"],
  sent: ["accepted", "cancelled"],
  accepted: ["active", "cancelled"],
  active: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

/**
 * One service agreement on glass: the service, its scope, the fee and the next status moves. The fee is
 * what the client agreed to pay (CLIENT-class), so it is a client amount in MoneyText; an agreement
 * carries no internal figure for this card to show.
 */
export function AgreementCard({
  agreement,
  enquiryId,
}: {
  readonly agreement: ServiceAgreementStaffView;
  readonly enquiryId: string;
}) {
  const toast = useToast();
  const transition = useTransitionServiceAgreement(agreement.id, enquiryId);
  const move = (status: ServiceAgreementStatus): void =>
    transition.mutate(
      { status },
      { onError: () => toast.show({ title: "Could not move the agreement", tone: "danger" }) },
    );
  const card = useSectionCard();
  return (
    <Card tone={card.tone} className={card.className} testID={`agreement-${agreement.id}`}>
      <Stack gap={3}>
        <RecordHeader title={agreement.serviceName} badge={staffAgreementBadge[agreement.status]} />
        <Text>{agreement.scopeText}</Text>
        <AgreementFee agreement={agreement} />
        <TransitionRow
          nexts={AGREEMENT_NEXT[agreement.status]}
          pending={transition.isPending}
          onMove={move}
        />
      </Stack>
    </Card>
  );
}

function AgreementFee({ agreement }: { readonly agreement: ServiceAgreementStaffView }) {
  return (
    <Row gap={3} justify="between" align="end" wrap className="border-t border-primary/16 pt-3">
      <Stack gap={1}>
        <Text variant="eyebrow">{`Fee · ${feeStructureLabel(agreement.feeStructure)}`}</Text>
        <MoneyText
          amount={clientAmount(agreement.fee.minor, agreement.fee.currency)}
          variant="heading"
        />
      </Stack>
      {agreement.termsVersion ? (
        <Text variant="data" tone="muted">{`Terms ${agreement.termsVersion}`}</Text>
      ) : null}
    </Row>
  );
}
