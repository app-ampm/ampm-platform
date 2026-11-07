import { useLeadActivities } from "@ampm/api-client";
import type { LeadActivityView } from "@ampm/core";
import { Card, Stack, Stepper, Text, type StepperStep } from "@ampm/ui";

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

/**
 * A lead's activity timeline (T3), newest first, as a vertical stepper of logged steps with their
 * time and summary. The timeline is secondary context: nothing shows while it loads, if it fails or
 * while the lead has no activity.
 *
 *   <LeadActivityCard leadId={lead.id} />
 */
export function LeadActivityCard({ leadId }: { readonly leadId: string }) {
  const activities = useLeadActivities(leadId);
  if (activities.isPending || activities.isError || activities.data.items.length === 0) return null;
  const steps = activities.data.items.map(activityStep);
  return (
    <Card className="md:p-6" testID="lead-activity">
      <Stack gap={4}>
        <Text variant="subheading">Activity</Text>
        <Stepper
          orientation="vertical"
          steps={steps}
          current={steps.length}
          stateLabels={STATE_LABELS}
          testID="lead-activity-timeline"
        />
      </Stack>
    </Card>
  );
}
