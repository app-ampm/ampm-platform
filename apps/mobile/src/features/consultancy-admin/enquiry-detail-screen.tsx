import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useStaffEnquiry } from "@ampm/api-client";
import { isAppError, type HotelEnquiryStaffDetailView } from "@ampm/core";
import {
  Button,
  Callout,
  Card,
  EmptyState,
  ErrorState,
  OfflineState,
  Row,
  Skeleton,
  Stack,
  StatusChip,
  Text,
} from "@ampm/ui";

import { eventLabel, formatDate, formatDateRange } from "../consultancy/consultancy.format";
import { staffEnquiryBadge } from "./consultancy-admin.format";
import { AgreementSection, ProposalsSection } from "./enquiry-commercial";
import { EnquiryStatusActions } from "./enquiry-status-actions";
import { MilestonesSection, VisitsSection } from "./enquiry-progress";

/** The staff view of one enquiry (consultancy-admin): the internal detail plus the pipeline controls. */
export function StaffEnquiryDetailScreen({ enquiryId }: { readonly enquiryId: string }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const enquiry = useStaffEnquiry(enquiryId);
  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="gap-4 p-4 md:p-8"
      style={{ paddingTop: insets.top }}
    >
      <Row justify="start">
        <Button variant="ghost" size="sm" icon="arrow-left" onPress={() => router.back()}>
          Enquiries
        </Button>
      </Row>
      <DetailBody enquiry={enquiry} enquiryId={enquiryId} />
    </ScrollView>
  );
}

function DetailBody({
  enquiry,
  enquiryId,
}: {
  readonly enquiry: ReturnType<typeof useStaffEnquiry>;
  readonly enquiryId: string;
}) {
  const router = useRouter();
  if (enquiry.isPending) return <DetailLoading />;
  if (enquiry.isError) {
    if (isAppError(enquiry.error) && enquiry.error.code === "network_error")
      return <OfflineState onRetry={() => void enquiry.refetch()} />;
    if (isAppError(enquiry.error) && enquiry.error.code === "unauthenticated")
      return (
        <EmptyState
          icon="lock"
          title="Sign in to view this enquiry"
          action={{ label: "Sign in", onPress: () => router.replace("/sign-in") }}
        />
      );
    if (isAppError(enquiry.error) && enquiry.error.code === "forbidden")
      return <EmptyState icon="lock" title="Not available for your role" />;
    if (isAppError(enquiry.error) && enquiry.error.code === "not_found")
      return <EmptyState icon="inbox" title="Enquiry not found" />;
    return <ErrorState onRetry={() => void enquiry.refetch()} />;
  }
  return (
    <Stack gap={4}>
      <EnquiryHeader enquiry={enquiry.data} />
      <EnquiryStatusActions enquiryId={enquiryId} status={enquiry.data.status} />
      <AgreementSection enquiryId={enquiryId} accountId={enquiry.data.accountId} />
      <ProposalsSection enquiryId={enquiryId} />
      <VisitsSection enquiryId={enquiryId} />
      <MilestonesSection enquiryId={enquiryId} />
      <Timeline events={enquiry.data.events} />
    </Stack>
  );
}

function EnquiryHeader({ enquiry }: { readonly enquiry: HotelEnquiryStaffDetailView }) {
  const badge = staffEnquiryBadge[enquiry.status];
  return (
    <Stack gap={2}>
      <Row gap={2} justify="between" align="start">
        <Text variant="title" className="flex-1">
          {enquiry.functionsSummary ?? "Hotel enquiry"}
        </Text>
        <StatusChip label={badge.label} tone={badge.tone} />
      </Row>
      <Text tone="muted">{`${formatDateRange(enquiry.dateFrom, enquiry.dateTo)} · ${enquiry.guestEstimate} guests`}</Text>
      {enquiry.notesClient ? <Text>{`Client note: ${enquiry.notesClient}`}</Text> : null}
      {enquiry.notesInternal ? (
        <Callout kind="info" title="Internal note">
          {enquiry.notesInternal}
        </Callout>
      ) : null}
      <Row gap={2} wrap>
        <StatusChip
          label={enquiry.assignedUserId ? "Assigned" : "Unassigned"}
          tone={enquiry.assignedUserId ? "neutral" : "warning"}
          size="sm"
        />
        <Text variant="bodySmall" tone="muted">{`Hotel ref ${enquiry.hotelId.slice(0, 8)}`}</Text>
      </Row>
    </Stack>
  );
}

/** The full event timeline — including the internal-only events a client never sees. */
function Timeline({ events }: { readonly events: HotelEnquiryStaffDetailView["events"] }) {
  if (events.length === 0) return null;
  return (
    <Stack gap={2}>
      <Text variant="subheading">Activity</Text>
      {events.map((event) => (
        <Card key={event.id}>
          <Stack gap={1}>
            <Row gap={2} justify="between" align="start">
              <Text variant="label" className="flex-1">
                {eventLabel(event.eventType)}
              </Text>
              {event.internalOnly ? <StatusChip label="internal" tone="warning" size="sm" /> : null}
            </Row>
            {event.summary ? <Text tone="muted">{event.summary}</Text> : null}
            <Text variant="bodySmall" tone="muted">
              {formatDate(event.occurredAt)}
            </Text>
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}

function DetailLoading() {
  return (
    <Stack gap={3} testID="staff-enquiry-loading">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-40 w-full" />
    </Stack>
  );
}
