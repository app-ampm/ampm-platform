import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useHotel, useHotelEnquiry } from "@ampm/api-client";
import {
  isAppError,
  type HotelEnquiryClientDetailView,
  type HotelEnquiryEventClientView,
} from "@ampm/core";
import {
  Button,
  EmptyState,
  ErrorState,
  OfflineState,
  Row,
  Skeleton,
  Stack,
  StatusChip,
  Text,
} from "@ampm/ui";

import { enquiryBadge, eventLabel, formatDate, formatDateRange } from "./consultancy.format";
import { AgreementSection, ProposalsSection } from "./request-commercial";
import { MilestonesSection, VisitsSection } from "./request-progress";

/** CP: one hotel request and everything hanging off it — the agreement, proposals, visits, milestones. */
export function RequestDetailScreen({ enquiryId }: { readonly enquiryId: string }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const enquiry = useHotelEnquiry(enquiryId);
  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="gap-4 p-4 md:p-8"
      style={{ paddingTop: insets.top }}
    >
      <Row justify="start">
        <Button variant="ghost" size="sm" icon="arrow-left" onPress={() => router.back()}>
          Back
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
  readonly enquiry: ReturnType<typeof useHotelEnquiry>;
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
          title="Sign in to view this request"
          action={{ label: "Sign in", onPress: () => router.replace("/sign-in") }}
        />
      );
    if (isAppError(enquiry.error) && enquiry.error.code === "not_found")
      return <EmptyState icon="inbox" title="Request not found" />;
    return <ErrorState onRetry={() => void enquiry.refetch()} />;
  }
  return (
    <Stack gap={4}>
      <EnquiryHeader enquiry={enquiry.data} />
      <AgreementSection enquiryId={enquiryId} />
      <ProposalsSection enquiryId={enquiryId} />
      <VisitsSection enquiryId={enquiryId} />
      <MilestonesSection enquiryId={enquiryId} />
      <Timeline events={enquiry.data.events} />
    </Stack>
  );
}

function EnquiryHeader({ enquiry }: { readonly enquiry: HotelEnquiryClientDetailView }) {
  const hotel = useHotel(enquiry.hotelId);
  const badge = enquiryBadge[enquiry.status];
  const rooms = enquiry.roomsRequired !== null ? ` · ${enquiry.roomsRequired} rooms` : "";
  return (
    <Stack gap={2}>
      <Row gap={2} justify="between" align="start">
        <Text variant="title" className="flex-1">
          {hotel.data?.name ?? "Hotel request"}
        </Text>
        <StatusChip label={badge.label} tone={badge.tone} />
      </Row>
      <Text tone="muted">{formatDateRange(enquiry.dateFrom, enquiry.dateTo)}</Text>
      <Text tone="muted">{`${enquiry.guestEstimate} guests${rooms}`}</Text>
      {enquiry.functionsSummary ? <Text>{enquiry.functionsSummary}</Text> : null}
      {enquiry.notesClient ? <Text tone="muted">{enquiry.notesClient}</Text> : null}
    </Stack>
  );
}

function Timeline({ events }: { readonly events: readonly HotelEnquiryEventClientView[] }) {
  if (events.length === 0) return null;
  return (
    <Stack gap={2}>
      <Text variant="subheading">Activity</Text>
      {events.map((event) => (
        <Row key={event.id} gap={2} justify="between" align="start">
          <Stack gap={0} className="flex-1">
            <Text variant="label">{eventLabel(event.eventType)}</Text>
            {event.summary ? <Text tone="muted">{event.summary}</Text> : null}
          </Stack>
          <Text tone="muted" variant="bodySmall">
            {formatDate(event.occurredAt)}
          </Text>
        </Row>
      ))}
    </Stack>
  );
}

function DetailLoading() {
  return (
    <Stack gap={3} testID="request-detail-loading">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </Stack>
  );
}
