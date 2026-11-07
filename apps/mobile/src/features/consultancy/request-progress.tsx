import { useState } from "react";

import { useBookingMilestones, useSiteVisits, useUpdateSiteVisitFeedback } from "@ampm/api-client";
import {
  clientAmount,
  type BookingMilestoneClientView,
  type SiteVisitClientView,
} from "@ampm/core";
import {
  Button,
  Card,
  Input,
  MoneyText,
  Row,
  Stack,
  StatusChip,
  Stepper,
  Text,
  useToast,
  type StepperStep,
} from "@ampm/ui";

import {
  formatDate,
  milestoneBadge,
  milestoneStepStates,
  milestoneTypeLabel,
  visitBadge,
} from "./consultancy.format";
import { SectionError } from "./section-error";
import { SectionSkeleton } from "./section-skeleton";

/** The site visits for this enquiry — the client reads date/status and leaves their own feedback. */
export function VisitsSection({ enquiryId }: { readonly enquiryId: string }) {
  const visits = useSiteVisits(enquiryId);
  if (visits.isPending) return <SectionSkeleton title="Site visits" />;
  if (visits.isError)
    return (
      <SectionError
        title="Site visits"
        error={visits.error}
        onRetry={() => void visits.refetch()}
      />
    );
  if (visits.data.items.length === 0) return null;
  return (
    <Stack gap={3}>
      <Text variant="heading">Site visits</Text>
      {visits.data.items.map((visit) => (
        <VisitCard key={visit.id} visit={visit} enquiryId={enquiryId} />
      ))}
    </Stack>
  );
}

function VisitHeading({ visit }: { readonly visit: SiteVisitClientView }) {
  const badge = visitBadge[visit.status];
  return (
    <Row gap={3} justify="between" align="start">
      <Text variant="heading" className="flex-1">
        {formatDate(visit.scheduledAt)}
      </Text>
      <StatusChip label={badge.label} tone={badge.tone} size="sm" />
    </Row>
  );
}

function VisitCard({
  visit,
  enquiryId,
}: {
  readonly visit: SiteVisitClientView;
  readonly enquiryId: string;
}) {
  const toast = useToast();
  const feedback = useUpdateSiteVisitFeedback(visit.id, enquiryId);
  const [text, setText] = useState(visit.clientFeedback ?? "");
  const onSave = (): void =>
    feedback.mutate(
      { clientFeedback: text.trim().length > 0 ? text : null },
      {
        onError: () => toast.show({ title: "Could not save your feedback", tone: "danger" }),
        onSuccess: () => toast.show({ title: "Feedback saved", tone: "success" }),
      },
    );
  return (
    <Card padding="lg">
      <Stack gap={3.5}>
        <VisitHeading visit={visit} />
        <Input
          label="Your feedback"
          value={text}
          onChangeText={setText}
          placeholder="How was the visit?"
          multiline
        />
        <Button variant="secondary" loading={feedback.isPending} onPress={onSave}>
          Save feedback
        </Button>
      </Stack>
    </Card>
  );
}

/** A milestone's status word and, where W-14 shows it, its client amount, under the step's label. */
function MilestoneMeta({ milestone }: { readonly milestone: BookingMilestoneClientView }) {
  const badge = milestoneBadge[milestone.status];
  return (
    <Row gap={3} wrap>
      <StatusChip label={badge.label} tone={badge.tone} size="sm" />
      {milestone.amount ? (
        <MoneyText amount={clientAmount(milestone.amount.minor, milestone.amount.currency)} />
      ) : null}
    </Row>
  );
}

/**
 * The milestones as vertical steps in the API's order, each with its own state: they need not finish
 * in order, and an overdue one needs the client's attention whatever comes before it.
 */
function milestoneSteps(milestones: readonly BookingMilestoneClientView[]): StepperStep[] {
  const states = milestoneStepStates(milestones.map((milestone) => milestone.status));
  return milestones.map((milestone, index) => ({
    key: milestone.id,
    label: milestoneTypeLabel(milestone.milestoneType),
    detail: milestone.dueAt ? `Due ${formatDate(milestone.dueAt)}` : undefined,
    state: states[index],
    content: <MilestoneMeta milestone={milestone} />,
  }));
}

/** The booking milestones for this enquiry — read-only for the client (amount shown only where W-14 is on). */
export function MilestonesSection({ enquiryId }: { readonly enquiryId: string }) {
  const milestones = useBookingMilestones(enquiryId);
  if (milestones.isPending) return <SectionSkeleton title="Booking milestones" />;
  if (milestones.isError)
    return (
      <SectionError
        title="Booking milestones"
        error={milestones.error}
        onRetry={() => void milestones.refetch()}
      />
    );
  if (milestones.data.items.length === 0) return null;
  return (
    <Stack gap={3}>
      <Text variant="heading">Booking milestones</Text>
      <Card padding="lg">
        <Stepper
          orientation="vertical"
          current={-1}
          steps={milestoneSteps(milestones.data.items)}
          testID="booking-milestones"
        />
      </Card>
    </Stack>
  );
}
