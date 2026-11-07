import { View } from "react-native";

import type { BillingType, ClientAmount, PlanModuleView, PlanPublicView } from "@ampm/core";
import { Card, Icon, MoneyText, Row, Stack, StatusChip, Text } from "@ampm/ui";

import { billingLabel, moduleLabel, termLabel, type PaymentPhase } from "./portal.format";

interface PlanChipProps {
  readonly billing: BillingType;
  readonly phase: PaymentPhase;
}

/** The plan's billing until a purchase starts, then the payment's status (waiting: gold soft). */
function PlanChip({ billing, phase }: PlanChipProps) {
  if (phase === "idle") return <StatusChip label={billingLabel(billing)} tone="info" />;
  return <StatusChip label="Payment pending" tone="warning" dot />;
}

/** What the plan includes, as a check list: one column on a phone, two from a tablet up (D2). */
function IncludedList({ modules }: { readonly modules: readonly PlanModuleView[] }) {
  if (modules.length === 0) return null;
  return (
    <View className="flex-row flex-wrap gap-y-2.5">
      {modules.map((module) => (
        <Row key={module.moduleKey} gap={2} className="w-full pr-4 md:w-1/2">
          <Icon name="check" size="sm" tone="highlight" />
          <Text tone="primary" className="shrink">
            {moduleLabel(module.moduleKey)}
          </Text>
        </Row>
      ))}
    </View>
  );
}

/** How long the plan runs once paid, on a flat row nested in the plan's glass card. */
function TermRow({ days }: { readonly days: number }) {
  return (
    <Card tone="flat" padding="sm">
      <Row gap={3} justify="between" wrap>
        <Text variant="eyebrow">Active for</Text>
        <Text variant="data">{termLabel(days)}</Text>
      </Row>
    </Card>
  );
}

export interface PlanSummaryProps {
  readonly plan: PlanPublicView;
  /** The plan's public price, a client amount. */
  readonly price: ClientAmount;
  readonly phase: PaymentPhase;
}

/**
 * The plan as D2's payment card shows it: the name over the price in Gilda Display, the billing (or,
 * once a purchase starts, the payment's status), what it includes and how long it runs.
 */
export function PlanSummary({ plan, price, phase }: PlanSummaryProps) {
  return (
    <Stack gap={4.5}>
      <Row gap={3} justify="between" align="start">
        <Stack gap={1.5} className="flex-1">
          <Text variant="eyebrow" accessibilityRole="header">
            {plan.name}
          </Text>
          <MoneyText amount={price} variant="stat" className="text-5xl" />
        </Stack>
        <PlanChip billing={plan.billingType} phase={phase} />
      </Row>
      <IncludedList modules={plan.modules} />
      {plan.termDays !== null ? <TermRow days={plan.termDays} /> : null}
    </Stack>
  );
}
