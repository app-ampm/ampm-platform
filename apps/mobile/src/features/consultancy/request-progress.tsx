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
  Skeleton,
  Stack,
  StatusChip,
  Text,
  useToast,
} from "@ampm/ui";

import { formatDate, milestoneBadge, milestoneTypeLabel, visitBadge } from "./consultancy.format";
import { SectionError } from "./section-error";

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
  readonly visit: SiteVisitClientView;
  readonly enquiryId: string;
}) {
  const toast = useToast();
  const feedback = useUpdateSiteVisitFeedback(visit.id, enquiryId);
  const [text, setText] = useState(visit.clientFeedback ?? "");
  const badge = visitBadge[visit.status];
  const onSave = (): void =>
    feedback.mutate(
      { clientFeedback: text.trim().length > 0 ? text : null },
      {
        onError: () => toast.show({ title: "Could not save your feedback", tone: "danger" }),
        onSuccess: () => toast.show({ title: "Feedback saved", tone: "success" }),
      },
    );
  return (
    <Card>
      <Stack gap={2}>
        <Row gap={2} justify="between" align="start">
          <Text variant="subheading" className="flex-1">
            {formatDate(visit.scheduledAt)}
          </Text>
          <StatusChip label={badge.label} tone={badge.tone} size="sm" />
        </Row>
        <Input
          label="Your feedback"
          value={text}
          onChangeText={setText}
          placeholder="How was the visit?"
        />
        <Row justify="start">
          <Button variant="secondary" size="sm" loading={feedback.isPending} onPress={onSave}>
            Save feedback
          </Button>
        </Row>
      </Stack>
    </Card>
  );
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
    <Stack gap={2}>
      <Text variant="subheading">Booking milestones</Text>
      {milestones.data.items.map((milestone) => (
        <MilestoneRow key={milestone.id} milestone={milestone} />
      ))}
    </Stack>
  );
}

function MilestoneRow({ milestone }: { readonly milestone: BookingMilestoneClientView }) {
  const badge = milestoneBadge[milestone.status];
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
        {milestone.amount ? (
          <MoneyText
            amount={clientAmount(milestone.amount.minor, milestone.amount.currency)}
            variant="subheading"
          />
        ) : null}
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
