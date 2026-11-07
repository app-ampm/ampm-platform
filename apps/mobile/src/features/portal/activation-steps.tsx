import { Stepper, type StepperStep } from "@ampm/ui";

/**
 * CP-11's three steps (D2). The wedding details reach AMPM when the account is created, so the client
 * meets this page on the payment step; discovery opens once the payment activates the subscription.
 */
const STEPS: readonly StepperStep[] = [
  { key: "wedding", label: "Your wedding" },
  { key: "payment", label: "Payment" },
  { key: "discovery", label: "Discovery opens" },
];
const CURRENT = 1;

/**
 * Where the client stands (D2): the kit's status stepper, the wedding done (a peacock check), the
 * payment current (a gold ring) and discovery still to come (a pearl ring), so the marker's shape and
 * each step's spoken state ("Payment, current step") carry it, never the colour alone.
 */
export function ActivationSteps() {
  return <Stepper steps={STEPS} current={CURRENT} testID="activation-steps" />;
}
