import { useLeadActivities } from "@ampm/api-client";
import type { LeadActivityView } from "@ampm/core";
import { Card, cn, Stack, Stepper, Text, type StepperStep } from "@ampm/ui";

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
  /** Layout from the screen: `flex-1` fills T3's main column to the height of the side one. */
  readonly className?: string | undefined;
}

/**
 * A lead's activity timeline (T3), newest first. Logging a touch is the record header's action, so the
 * card only reads; it always shows, saying so when nothing is logged yet.
 *
 *   <LeadActivityCard leadId={lead.id} />
 */
export function LeadActivityCard({ leadId, className }: LeadActivityCardProps) {
  return (
    <Card className={cn("md:p-6", className)} testID="lead-activity">
      <Stack gap={4}>
        <Text variant="subheading">Activity</Text>
        <Timeline leadId={leadId} />
      </Stack>
    </Card>
  );
}
