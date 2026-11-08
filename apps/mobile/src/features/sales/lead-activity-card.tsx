import { useLeadActivities } from "@ampm/api-client";
import type { LeadActivityView } from "@ampm/core";
import { Button, Card, Row, Stack, Stepper, Text, type StepperStep } from "@ampm/ui";

import { activityLabel, formatMoment } from "./sales.format";

/** Every activity has happened: read each step as "Call, logged, …" rather than "done". */
const STATE_LABELS = { done: "logged" } as const;

function activityStep(activity: LeadActivityView): StepperStep {
  return {
    key: activity.id,
    label: activityLabel(activity.activityType),
    detail: formatMoment(activity.occurredAt),
    content: activity.summary ? <Text variant="bodySmall">{activity.summary}</Text> : undefined,
  };
}

/** The timeline itself, newest first; secondary context, so nothing shows while it loads or if it fails. */
function Timeline({ leadId }: { readonly leadId: string }) {
  const activities = useLeadActivities(leadId);
  if (activities.isPending || activities.isError) return null;
  if (activities.data.items.length === 0) {
    return (
      <Text variant="bodySmall" tone="muted">
        No activity logged yet.
      </Text>
    );
  }
  const steps = activities.data.items.map(activityStep);
  return (
    <Stepper
      orientation="vertical"
      steps={steps}
      current={steps.length}
      stateLabels={STATE_LABELS}
      testID="lead-activity-timeline"
    />
  );
}

export interface LeadActivityCardProps {
  readonly leadId: string;
  /** Opens the log-activity sheet; omitted on a terminal (read-only) lead, so the action is hidden. */
  readonly onAdd?: (() => void) | undefined;
}

/**
 * A lead's activity timeline (T3) with the action to log a new touch (`crm.leads.update`). The timeline
 * is secondary context; the card always shows so a salesperson can log the first activity.
 *
 *   <LeadActivityCard leadId={lead.id} onAdd={openSheet} />
 */
export function LeadActivityCard({ leadId, onAdd }: LeadActivityCardProps) {
  return (
    <Card className="md:p-6" testID="lead-activity">
      <Stack gap={4}>
        <Row gap={2} align="center" justify="between">
          <Text variant="subheading">Activity</Text>
          {onAdd ? (
            <Button
              variant="secondary"
              size="sm"
              icon="plus"
              onPress={onAdd}
              testID="lead-activity-add"
            >
              Log activity
            </Button>
          ) : null}
        </Row>
        <Timeline leadId={leadId} />
      </Stack>
    </Card>
  );
}
