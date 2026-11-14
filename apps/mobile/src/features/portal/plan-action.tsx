import { Button, Callout, Stack, Text } from "@ampm/ui";

import type { PaymentPhase } from "./portal.format";

export interface PlanActionProps {
  readonly phase: PaymentPhase;
  /** The price as the pay button reads it ("₹50,000"). */
  readonly price: string;
  /** primary: the screen's one gold action (a lone plan); secondary when several plans compete. */
  readonly payVariant: "primary" | "secondary";
  readonly subscribing: boolean;
  /** The pending payment is the dev stub, so the control completes it directly rather than reopening checkout. */
  readonly demo: boolean;
  readonly onSubscribe: () => void;
  readonly onComplete: () => void;
}

interface PendingPaymentProps {
  /** The payment is on its way: the button stays busy and disabled so it can't be sent twice. */
  readonly activating: boolean;
  readonly demo: boolean;
  readonly onComplete: () => void;
}

/**
 * A started subscription waits for its payment: the dev stub completes it directly (a demo control), while
 * a real Razorpay order reopens the hosted checkout to resume the payment. A peacock confirm action.
 */
function PendingPayment({ activating, demo, onComplete }: PendingPaymentProps) {
  return (
    <Stack gap={3}>
      <Callout
        kind="awaiting-confirmation"
        title="Complete the payment to activate your subscription."
        blur={false}
      />
      <Button
        fullWidth
        size="lg"
        variant="highlight"
        loading={activating}
        disabled={activating}
        onPress={onComplete}
      >
        {demo ? "Complete payment (demo)" : "Resume payment"}
      </Button>
    </Stack>
  );
}

/** Pay for the plan (with the terms under the button), then complete the started payment. */
export function PlanAction({
  phase,
  price,
  payVariant,
  subscribing,
  demo,
  onSubscribe,
  onComplete,
}: PlanActionProps) {
  if (phase !== "idle") {
    return (
      <PendingPayment activating={phase === "activating"} demo={demo} onComplete={onComplete} />
    );
  }
  return (
    <Stack gap={3}>
      <Button fullWidth size="lg" variant={payVariant} loading={subscribing} onPress={onSubscribe}>
        {`Pay ${price}`}
      </Button>
      <Text variant="caption" align="center">
        The subscription is non-refundable. Renewal is a new purchase.
      </Text>
    </Stack>
  );
}
