import { useState } from "react";

import { useCompletePayment, usePortalSubscribe, useVerifyPayment } from "@ampm/api-client";
import { type SubscriptionOrder } from "@ampm/core";
import { useToast } from "@ampm/ui";

import { paymentPhase, type PaymentPhase } from "./portal.format";
import {
  isRazorpayCheckoutAvailable,
  openRazorpayCheckout,
  RazorpayCheckoutDismissedError,
} from "./razorpay-checkout";

interface Pending {
  readonly subscriptionId: string;
  readonly order: SubscriptionOrder;
}

export interface PlanPurchase {
  readonly phase: PaymentPhase;
  /** The subscription is being created (the pay button shows it is busy). */
  readonly subscribing: boolean;
  /** The pending payment is the dev stub, so the pay control reads as a demo (not a resumable checkout). */
  readonly demo: boolean;
  readonly subscribe: () => void;
  readonly completePayment: () => void;
}

/** A stub order (dev/staging) completes through the dev endpoint; a razorpay order through hosted checkout. */
const isStubOrder = (order: SubscriptionOrder): boolean => order.provider === "stub";

/**
 * Take a pending subscription's payment through Razorpay's hosted checkout and verify the signed result.
 * A stub order returns early (the caller shows the demo control); on web, checkout opens and the success
 * posts to verify-payment; a dismissed modal stays pending; a failure toasts. Native has no web checkout.
 */
function takeHostedPayment(
  target: Pending,
  planName: string,
  verify: ReturnType<typeof useVerifyPayment>,
  toast: ReturnType<typeof useToast>,
): void {
  if (isStubOrder(target.order)) return; // the stub completes through the dev endpoint, not checkout
  if (!isRazorpayCheckoutAvailable) {
    toast.show({ title: "Open the web portal to complete your payment", tone: "danger" });
    return;
  }
  openRazorpayCheckout({
    keyId: target.order.keyId,
    orderId: target.order.orderId,
    amount: target.order.amount,
    description: planName,
  })
    .then((result) =>
      verify.mutate(
        { subscriptionId: target.subscriptionId, ...result },
        {
          onError: () => toast.show({ title: "We could not confirm your payment", tone: "danger" }),
        },
      ),
    )
    .catch((error: unknown) => {
      if (error instanceof RazorpayCheckoutDismissedError) return; // closed the modal; stay pending
      toast.show({ title: "The payment did not go through", tone: "danger" });
    });
}

/**
 * The client's purchase of one plan (CP-11): start a pending subscription, then take its payment. A real
 * Razorpay order opens hosted checkout and posts the signed result to verify-payment; the dev stub
 * completes through the development endpoint. Both mutations refetch `/me`, whose new entitlements open
 * hotel discovery; failures surface as toasts.
 */
export function usePlanPurchase(planId: string, planName: string): PlanPurchase {
  const toast = useToast();
  const subscribe = usePortalSubscribe();
  const complete = useCompletePayment();
  const verify = useVerifyPayment();
  const [pending, setPending] = useState<Pending | null>(null);

  const start = (): void => {
    subscribe.mutate(
      { planId },
      {
        onSuccess: ({ subscriptionId, order }) => {
          const target = { subscriptionId, order };
          setPending(target);
          takeHostedPayment(target, planName, verify, toast);
        },
        onError: () => toast.show({ title: "Could not start the subscription", tone: "danger" }),
      },
    );
  };

  const completePayment = (): void => {
    if (!pending) return;
    if (!isStubOrder(pending.order)) {
      takeHostedPayment(pending, planName, verify, toast); // reopen checkout after a dismissed modal
      return;
    }
    complete.mutate(
      { subscriptionId: pending.subscriptionId },
      { onError: () => toast.show({ title: "Could not complete the payment", tone: "danger" }) },
    );
  };

  // Activating stays true from the payment's first tap through the /me refetch, so it can't be re-sent.
  const settling = complete.isPending || complete.isSuccess || verify.isPending || verify.isSuccess;
  return {
    phase: paymentPhase(pending?.subscriptionId ?? null, settling),
    subscribing: subscribe.isPending,
    demo: pending ? isStubOrder(pending.order) : false,
    subscribe: start,
    completePayment,
  };
}
