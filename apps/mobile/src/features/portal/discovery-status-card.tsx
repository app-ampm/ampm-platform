import { Card, Row, Stack, StatusChip, Text, cn } from "@ampm/ui";

/**
 * The subscription on peacock glass (D4, P2). `/me` and the plan catalogue carry no expiry, so the
 * days-left meter is left out and the chip says the plan is active. Beside D4's taller search card the
 * caller can spread it (`justify-between`): the label at the top, the plan at the foot.
 */
export function DiscoveryStatusCard({ className }: { readonly className?: string | undefined }) {
  return (
    <Card tone="peacock" className={cn("gap-2", className)} testID="discovery-status-card">
      <Row gap={3} justify="between">
        {/* Pearl 80% on peacock glass: pearl 58% falls under 4.5:1 there. */}
        <Text variant="eyebrow" tone="body">
          Your plan
        </Text>
        <StatusChip label="Active" tone="success" size="sm" />
      </Row>
      <Stack gap={2}>
        <Text variant="heading">Hotel discovery</Text>
        <Text tone="body">You can now search all hotels.</Text>
      </Stack>
    </Card>
  );
}
