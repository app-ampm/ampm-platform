import { clientAmount, type PlanPublicView } from "@ampm/core";
import { Card, formatMoney } from "@ampm/ui";

import { PlanAction } from "./plan-action";
import { PlanSummary } from "./plan-summary";
import { usePlanPurchase } from "./use-plan-purchase";

export interface PlanCardProps {
  readonly plan: PlanPublicView;
  /** primary for a lone plan (the screen's one gold action), secondary when several plans compete. */
  readonly payVariant: "primary" | "secondary";
}

/** One plan on base glass (D2's payment card): its summary, then pay and complete the payment. */
export function PlanCard({ plan, payVariant }: PlanCardProps) {
  const purchase = usePlanPurchase(plan.id);
  const price = clientAmount(plan.price.minor, plan.price.currency);
  return (
    <Card padding="lg" className="gap-5 md:p-9" testID={`plan-${plan.planKey}`}>
      <PlanSummary plan={plan} price={price} phase={purchase.phase} />
      <PlanAction
        phase={purchase.phase}
        price={formatMoney(price).text}
        payVariant={payVariant}
        subscribing={purchase.subscribing}
        onSubscribe={purchase.subscribe}
        onComplete={purchase.completePayment}
      />
    </Card>
  );
}
