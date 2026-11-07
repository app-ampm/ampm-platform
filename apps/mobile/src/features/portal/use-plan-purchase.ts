import { useState } from "react";

import { useCompletePayment, usePortalSubscribe } from "@ampm/api-client";
import { useToast } from "@ampm/ui";

import { paymentPhase, type PaymentPhase } from "./portal.format";

export interface PlanPurchase {
  readonly phase: PaymentPhase;
  /** The subscription is being created (the pay button shows it is busy). */
  readonly subscribing: boolean;
  readonly subscribe: () => void;
  readonly completePayment: () => void;
}

/**
 * The client's purchase of one plan (CP-11): start a pending subscription, then complete its payment
 * (the development stub's stand-in for the hosted checkout). Both mutations refetch `/me`, whose new
 * entitlements open hotel discovery; failures surface as toasts.
 */
export function usePlanPurchase(planId: string): PlanPurchase {
  const toast = useToast();
  const subscribe = usePortalSubscribe();
  const complete = useCompletePayment();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const start = (): void => {
    subscribe.mutate(
      { planId },
      {
        onSuccess: (result) => setPendingId(result.subscriptionId),
        onError: () => toast.show({ title: "Could not start the subscription", tone: "danger" }),
      },
    );
  };
  const completePayment = (): void => {
    if (!pendingId) return;
    complete.mutate(
      { subscriptionId: pendingId },
      { onError: () => toast.show({ title: "Could not complete the payment", tone: "danger" }) },
    );
  };

  return {
    // Activating stays true from the first tap through the /me refetch, so the payment can't be re-sent.
    phase: paymentPhase(pendingId, complete.isPending || complete.isSuccess),
    subscribing: subscribe.isPending,
    subscribe: start,
    completePayment,
  };
}
