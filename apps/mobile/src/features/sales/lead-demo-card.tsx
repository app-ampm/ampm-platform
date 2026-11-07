import type { LeadStatus, LeadView } from "@ampm/core";
import { Card, Row, Stack, StatusChip, Text, type StatusTone } from "@ampm/ui";

import { LeadFactRow } from "./lead-fact-row";

interface DemoStage {
  readonly label: string;
  readonly tone: StatusTone;
}

/**
 * The stages that say where the demo stands: offered (the lead has the next move) and accessed (done).
 * Other stages do not say, so the card shows only whether the enquiry asked for one.
 */
const DEMO_STAGE: Partial<Record<LeadStatus, DemoStage>> = {
  demo_offered: { label: "Offered", tone: "warning" },
  demo_accessed: { label: "Accessed", tone: "success" },
};

/**
 * Demo access on T3: gold glass while a demo is live (offered or accessed) with its stage as a chip,
 * base glass otherwise; whether the enquiry asked for a demo either way.
 *
 *   <LeadDemoCard lead={lead} />
 */
export function LeadDemoCard({ lead }: { readonly lead: LeadView }) {
  const stage = DEMO_STAGE[lead.status];
  return (
    <Card tone={stage ? "gold" : "glass"} className="md:p-6" testID="lead-demo">
      <Stack gap={3.5}>
        <Row gap={2} justify="between">
          <Text variant="subheading" className="flex-1">
            Demo access
          </Text>
          {stage ? <StatusChip label={stage.label} tone={stage.tone} size="sm" /> : null}
        </Row>
        <LeadFactRow
          label="Demo requested"
          value={lead.requestedDemo ? "Yes" : "No"}
          labelTone={stage ? "body" : "muted"}
        />
      </Stack>
    </Card>
  );
}
