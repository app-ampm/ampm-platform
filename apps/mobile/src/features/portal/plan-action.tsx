import { Button, Callout, Stack, Text } from "@ampm/ui";

import type { PaymentPhase } from "./portal.format";

export interface PlanActionProps {
  readonly phase: PaymentPhase;
  /** The price as the pay button reads it ("₹50,000"). */
  readonly price: string;
  /** primary: the screen's one gold action (a lone plan); secondary when several plans compete. */
  readonly payVariant: "primary" | "secondary";
  readonly subscribing: boolean;
  readonly onSubscribe: () => void;
  readonly onComplete: () => void;
}

interface PendingPaymentProps {
  /** The payment is on its way: the button stays busy and disabled so it can't be sent twice. */
  readonly activating: boolean;
  readonly onComplete: () => void;
}

/**
 * A started subscription waits for its payment: the development stub's stand-in for the hosted
 * checkout completes it, a peacock confirm action.
 */
function PendingPayment({ activating, onComplete }: PendingPaymentProps) {
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
        Complete payment (demo)
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
  onSubscribe,
  onComplete,
}: PlanActionProps) {
  if (phase !== "idle") {
    return <PendingPayment activating={phase === "activating"} onComplete={onComplete} />;
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
