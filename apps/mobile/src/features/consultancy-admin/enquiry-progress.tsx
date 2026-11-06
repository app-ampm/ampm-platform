import {
  useStaffBookingMilestones,
  useStaffSiteVisits,
  useTransitionBookingMilestone,
  useTransitionSiteVisit,
} from "@ampm/api-client";
import {
  clientAmount,
  type BookingMilestoneStaffView,
  type BookingMilestoneStatus,
  type SiteVisitStaffView,
  type SiteVisitStatus,
} from "@ampm/core";
import { Card, MoneyText, Row, Skeleton, Stack, StatusChip, Text, useToast } from "@ampm/ui";

import {
  formatDate,
  milestoneBadge,
  milestoneTypeLabel,
  visitBadge,
} from "../consultancy/consultancy.format";
import { SectionError } from "../consultancy/section-error";
import { TransitionRow } from "./transition-row";

const VISIT_NEXT: Record<SiteVisitStatus, readonly SiteVisitStatus[]> = {
  proposed: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

const MILESTONE_NEXT: Record<BookingMilestoneStatus, readonly BookingMilestoneStatus[]> = {
  pending: ["done", "cancelled"],
  overdue: ["done", "cancelled"],
  done: [],
  cancelled: [],
};

/** The site visits for this enquiry; staff read the internal attendees/outcome and move the status. */
export function VisitsSection({ enquiryId }: { readonly enquiryId: string }) {
  const visits = useStaffSiteVisits(enquiryId);
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
    <Stack gap={2}>
      <Text variant="subheading">Site visits</Text>
      {visits.data.items.map((visit) => (
        <VisitCard key={visit.id} visit={visit} enquiryId={enquiryId} />
      ))}
    </Stack>
  );
}

function VisitCard({
  visit,
  enquiryId,
}: {
  readonly visit: SiteVisitStaffView;
  readonly enquiryId: string;
}) {
  const toast = useToast();
  const transition = useTransitionSiteVisit(visit.id, enquiryId);
  const badge = visitBadge[visit.status];
  const move = (status: SiteVisitStatus): void =>
    transition.mutate(
      { status },
      { onError: () => toast.show({ title: "Could not move the visit", tone: "danger" }) },
    );
  return (
    <Card>
      <Stack gap={1}>
        <Row gap={2} justify="between" align="start">
          <Text variant="subheading" className="flex-1">
            {formatDate(visit.scheduledAt)}
          </Text>
          <StatusChip label={badge.label} tone={badge.tone} size="sm" />
        </Row>
        {visit.attendeesText ? (
          <Text tone="muted">{`Attendees: ${visit.attendeesText}`}</Text>
        ) : null}
        {visit.outcomeInternal ? (
          <Text tone="muted">{`Outcome: ${visit.outcomeInternal}`}</Text>
        ) : null}
        {visit.clientFeedback ? <Text>{`Client: ${visit.clientFeedback}`}</Text> : null}
        <TransitionRow
          nexts={VISIT_NEXT[visit.status]}
          pending={transition.isPending}
          onMove={move}
        />
      </Stack>
    </Card>
  );
}

/** The booking milestones; staff see every amount and move pending ones to done (or cancelled). */
export function MilestonesSection({ enquiryId }: { readonly enquiryId: string }) {
  const milestones = useStaffBookingMilestones(enquiryId);
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
    <Stack gap={2}>
      <Text variant="subheading">Booking milestones</Text>
      {milestones.data.items.map((milestone) => (
        <MilestoneCard key={milestone.id} milestone={milestone} enquiryId={enquiryId} />
      ))}
    </Stack>
  );
}

function MilestoneCard({
  milestone,
  enquiryId,
}: {
  readonly milestone: BookingMilestoneStaffView;
  readonly enquiryId: string;
}) {
  const toast = useToast();
  const transition = useTransitionBookingMilestone(milestone.id, enquiryId);
  const badge = milestoneBadge[milestone.status];
  const move = (status: BookingMilestoneStatus): void =>
    transition.mutate(
      { status },
      { onError: () => toast.show({ title: "Could not move the milestone", tone: "danger" }) },
    );
  return (
    <Card>
      <Stack gap={1}>
        <Row gap={2} justify="between" align="start">
          <Text variant="subheading" className="flex-1">
            {milestoneTypeLabel(milestone.milestoneType)}
          </Text>
          <StatusChip label={badge.label} tone={badge.tone} size="sm" />
        </Row>
        {milestone.dueAt ? <Text tone="muted">{`Due ${formatDate(milestone.dueAt)}`}</Text> : null}
        <Row gap={2} wrap>
          {milestone.amount ? (
            <MoneyText amount={clientAmount(milestone.amount.minor, milestone.amount.currency)} />
          ) : null}
          {milestone.documentId ? <StatusChip label="document" tone="info" size="sm" /> : null}
        </Row>
        <TransitionRow
          nexts={MILESTONE_NEXT[milestone.status]}
          pending={transition.isPending}
          onMove={move}
        />
      </Stack>
    </Card>
  );
}

function SectionSkeleton({ title }: { readonly title: string }) {
  return (
    <Stack gap={2}>
      <Text variant="subheading">{title}</Text>
      <Skeleton className="h-24 w-full" />
    </Stack>
  );
}
