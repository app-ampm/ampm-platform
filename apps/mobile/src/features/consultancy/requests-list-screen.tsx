import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useHotelEnquiries } from "@ampm/api-client";
import { isAppError, type HotelEnquiryClientView } from "@ampm/core";
import {
  Button,
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

import { enquiryBadge, formatDateRange } from "./consultancy.format";

/** CP: the client's hotel-assistance requests (their own enquiries). Tap one to see its progress. */
export function RequestsListScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const enquiries = useHotelEnquiries();
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
      <Text variant="title">Your hotel requests</Text>
      <RequestsBody enquiries={enquiries} />
    </ScrollView>
  );
}

function RequestsBody({ enquiries }: { readonly enquiries: ReturnType<typeof useHotelEnquiries> }) {
  const router = useRouter();
  if (enquiries.isPending) return <ListLoading />;
  if (enquiries.isError) {
    if (isAppError(enquiries.error) && enquiries.error.code === "network_error")
      return <OfflineState onRetry={() => void enquiries.refetch()} />;
    if (isAppError(enquiries.error) && enquiries.error.code === "unauthenticated")
      return (
        <EmptyState
          icon="lock"
          title="Sign in to view your requests"
          action={{ label: "Sign in", onPress: () => router.replace("/sign-in") }}
        />
      );
    return <ErrorState onRetry={() => void enquiries.refetch()} />;
  }
  if (enquiries.data.items.length === 0) {
    return (
      <EmptyState
        icon="inbox"
        title="No hotel requests yet"
        description="Open a hotel and tap “Request hotel assistance” to start one."
        action={{ label: "Browse hotels", onPress: () => router.push("/hotels") }}
      />
    );
  }
  return (
    <Stack gap={3}>
      {enquiries.data.items.map((enquiry) => (
        <RequestCard key={enquiry.id} enquiry={enquiry} />
      ))}
    </Stack>
  );
}

function RequestCard({ enquiry }: { readonly enquiry: HotelEnquiryClientView }) {
  const router = useRouter();
  const badge = enquiryBadge[enquiry.status];
  return (
    <Card>
      <Stack gap={2}>
        <Row gap={2} justify="between" align="start">
          <Text variant="subheading" className="flex-1">
            Hotel request
          </Text>
          <StatusChip label={badge.label} tone={badge.tone} size="sm" />
        </Row>
        <Text tone="muted">{formatDateRange(enquiry.dateFrom, enquiry.dateTo)}</Text>
        <Text tone="muted">{`${enquiry.guestEstimate} guests`}</Text>
        <Row justify="start">
          <Button
            variant="secondary"
            size="sm"
            icon="arrow-right"
            onPress={() => router.push(`/portal/requests/${enquiry.id}`)}
          >
            View request
          </Button>
        </Row>
      </Stack>
    </Card>
  );
}

function ListLoading() {
  return (
    <Stack gap={3} testID="requests-loading">
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </Stack>
  );
}
