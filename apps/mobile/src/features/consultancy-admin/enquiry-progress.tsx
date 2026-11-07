import type { ReactNode } from "react";

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
import {
  Card,
  InternalPanel,
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
  milestoneStepStates,
  milestoneTypeLabel,
} from "../consultancy/consultancy.format";
import { SectionError } from "../consultancy/section-error";
import { SectionSkeleton } from "../consultancy/section-skeleton";
import { staffMilestoneBadge, staffVisitBadge, visitStepState } from "./consultancy-admin.format";
import { CreateToggle } from "./consultancy-admin.widgets";
import { MilestoneCreateForm } from "./milestone-create-form";
import { SectionShell } from "./section-parts";
import { TransitionRow } from "./transition-row";
import { VisitCreateForm } from "./visit-create-form";

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

const VISITS_TITLE = "Site visits";
const MILESTONES_TITLE = "Booking milestones";

const byScheduledAt = (a: SiteVisitStaffView, b: SiteVisitStaffView): number =>
  Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt);

/**
 * The site visits on a vertical Stepper, oldest first: a completed visit done, a proposed or confirmed
 * one current, a cancelled one off the line. Staff read the internal attendees and outcome and move
 * the status.
 */
export function VisitsSection({ enquiryId }: { readonly enquiryId: string }) {
  const visits = useStaffSiteVisits(enquiryId);
  if (visits.isPending) return <SectionSkeleton title={VISITS_TITLE} />;
  if (visits.isError)
    return (
      <SectionError
        title={VISITS_TITLE}
        error={visits.error}
        onRetry={() => void visits.refetch()}
      />
    );
  const steps = [...visits.data.items].sort(byScheduledAt).map((visit): StepperStep => ({
    key: visit.id,
    label: formatDate(visit.scheduledAt),
    state: visitStepState[visit.status],
    content: <VisitStep visit={visit} enquiryId={enquiryId} />,
  }));
  return (
    <ProgressSection
      title={VISITS_TITLE}
      steps={steps}
      empty="No site visit yet. Schedule one when the client wants to see the hotel."
      testID="site-visits"
    >
      <CreateToggle label="New site visit">
        {(done) => <VisitCreateForm enquiryId={enquiryId} onDone={done} />}
      </CreateToggle>
    </ProgressSection>
  );
}

function VisitStep({
  visit,
  enquiryId,
}: {
  readonly visit: SiteVisitStaffView;
  readonly enquiryId: string;
}) {
  const toast = useToast();
  const transition = useTransitionSiteVisit(visit.id, enquiryId);
  const badge = staffVisitBadge[visit.status];
  const move = (status: SiteVisitStatus): void =>
    transition.mutate(
      { status },
      { onError: () => toast.show({ title: "Could not move the visit", tone: "danger" }) },
    );
  return (
    <Stack gap={2}>
      <StatusChip label={badge.label} tone={badge.tone} size="sm" />
      {visit.clientFeedback ? (
        <Text variant="bodySmall" tone="body">{`Client: ${visit.clientFeedback}`}</Text>
      ) : null}
      <VisitInternalNotes visit={visit} />
      <TransitionRow
        nexts={VISIT_NEXT[visit.status]}
        pending={transition.isPending}
        onMove={move}
      />
    </Stack>
  );
}

/** The attendees and outcome a client never sees: internal notes, so they sit in an InternalPanel. */
function VisitInternalNotes({ visit }: { readonly visit: SiteVisitStaffView }) {
  if (!visit.attendeesText && !visit.outcomeInternal) return null;
  return (
    <InternalPanel className="rounded">
      {visit.attendeesText ? (
        <Text variant="bodySmall" tone="body">{`Attendees: ${visit.attendeesText}`}</Text>
      ) : null}
      {visit.outcomeInternal ? (
        <Text variant="bodySmall" tone="body">{`Outcome: ${visit.outcomeInternal}`}</Text>
      ) : null}
    </InternalPanel>
  );
}

/**
 * The booking milestones on a vertical Stepper in the order they were added. Staff see every amount
 * and move a pending or overdue milestone to done (or cancelled).
 */
export function MilestonesSection({ enquiryId }: { readonly enquiryId: string }) {
  const milestones = useStaffBookingMilestones(enquiryId);
  if (milestones.isPending) return <SectionSkeleton title={MILESTONES_TITLE} />;
  if (milestones.isError)
    return (
      <SectionError
        title={MILESTONES_TITLE}
        error={milestones.error}
        onRetry={() => void milestones.refetch()}
      />
    );
  const items = milestones.data.items;
  const states = milestoneStepStates(items.map((milestone) => milestone.status));
  const steps = items.map((milestone, index): StepperStep => ({
    key: milestone.id,
    label: milestoneTypeLabel(milestone.milestoneType),
    detail: milestone.dueAt ? `Due ${formatDate(milestone.dueAt)}` : undefined,
    state: states[index],
    content: <MilestoneStep milestone={milestone} enquiryId={enquiryId} />,
  }));
  return (
    <ProgressSection
      title={MILESTONES_TITLE}
      steps={steps}
      empty="No milestone yet. Add them once the hotel holds the dates."
      testID="milestones"
    >
      <CreateToggle label="New milestone">
        {(done) => <MilestoneCreateForm enquiryId={enquiryId} onDone={done} />}
      </CreateToggle>
    </ProgressSection>
  );
}

function MilestoneStep({
  milestone,
  enquiryId,
}: {
  readonly milestone: BookingMilestoneStaffView;
  readonly enquiryId: string;
}) {
  const toast = useToast();
  const transition = useTransitionBookingMilestone(milestone.id, enquiryId);
  const badge = staffMilestoneBadge[milestone.status];
  const move = (status: BookingMilestoneStatus): void =>
    transition.mutate(
      { status },
      { onError: () => toast.show({ title: "Could not move the milestone", tone: "danger" }) },
    );
  return (
    <Stack gap={2}>
      <Row gap={2} wrap align="center">
        <StatusChip label={badge.label} tone={badge.tone} size="sm" />
        {milestone.documentId ? <StatusChip label="Document" tone="info" size="sm" /> : null}
        {milestone.amount ? (
          <MoneyText amount={clientAmount(milestone.amount.minor, milestone.amount.currency)} />
        ) : null}
      </Row>
      <TransitionRow
        nexts={MILESTONE_NEXT[milestone.status]}
        pending={transition.isPending}
        onMove={move}
      />
    </Stack>
  );
}

/**
 * A progress section in the commercial sections' frame (SectionShell): its Gilda heading, the records
 * on a vertical Stepper in one glass card (or, with none yet, the line that says what creates the
 * first), then the section's "New …" action.
 */
function ProgressSection({
  title,
  steps,
  empty,
  testID,
  children,
}: {
  readonly title: string;
  readonly steps: readonly StepperStep[];
  readonly empty: string;
  readonly testID: string;
  readonly children: ReactNode;
}) {
  return (
    <SectionShell title={title} empty={steps.length === 0 ? empty : null}>
      {steps.length > 0 ? (
        <Card className="md:p-7">
          <Stepper orientation="vertical" current={-1} steps={steps} testID={testID} />
        </Card>
      ) : null}
      {children}
    </SectionShell>
  );
}
