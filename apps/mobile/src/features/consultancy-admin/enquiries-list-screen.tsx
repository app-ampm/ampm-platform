import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { useMe, useStaffEnquiries } from "@ampm/api-client";
import { isAppError, type HotelEnquiryStaffView } from "@ampm/core";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Link,
  OfflineState,
  Row,
  Skeleton,
  Stack,
  StatusChip,
  Text,
} from "@ampm/ui";

import { setAccessToken } from "@/lib/session";
import { formatDateRange } from "../consultancy/consultancy.format";
import { staffEnquiryBadge } from "./consultancy-admin.format";

/** The staff hotel-enquiry pipeline (consultancy-admin): every account's enquiries, newest first. */
export function StaffEnquiriesListScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const enquiries = useStaffEnquiries();
  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="gap-4 p-4 md:p-8"
      style={{ paddingTop: insets.top }}
    >
      <StaffHeader />
      {enquiries.isPending ? (
        <ListLoading />
      ) : enquiries.isError ? (
        <ListError error={enquiries.error} onRetry={() => void enquiries.refetch()} />
      ) : enquiries.data.items.length === 0 ? (
        <EmptyState icon="inbox" title="No hotel enquiries yet" />
      ) : (
        <Stack gap={2}>
          {enquiries.data.items.map((enquiry) => (
            <EnquiryRow
              key={enquiry.id}
              enquiry={enquiry}
              onPress={() => router.push(`/enquiries/${enquiry.id}`)}
            />
          ))}
        </Stack>
      )}
    </ScrollView>
  );
}

/** Title, the signed-in staff member, a link across to Leads, and sign-out. */
function StaffHeader() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useMe();
  const signOut = (): void => {
    setAccessToken(null);
    queryClient.clear();
    router.replace("/sign-in");
  };
  return (
    <Stack gap={2}>
      <Row gap={2} justify="between" align="start">
        <Stack gap={0}>
          <Text variant="title">Hotel enquiries</Text>
          {me.data ? <Text tone="muted">{`Signed in as ${me.data.principal.name}`}</Text> : null}
        </Stack>
        <Button variant="ghost" size="sm" onPress={signOut}>
          Sign out
        </Button>
      </Row>
      <Link href="/leads" variant="standalone" tone="muted">
        Leads workspace
      </Link>
    </Stack>
  );
}

function EnquiryRow({
  enquiry,
  onPress,
}: {
  readonly enquiry: HotelEnquiryStaffView;
  readonly onPress: () => void;
}) {
  const badge = staffEnquiryBadge[enquiry.status];
  return (
    <Card onPress={onPress} accessibilityLabel={`Enquiry: ${badge.label}`}>
      <Stack gap={1}>
        <Row gap={2} justify="between" align="start">
          <Text variant="subheading" numberOfLines={1} className="flex-1">
            {enquiry.functionsSummary ?? "Hotel enquiry"}
          </Text>
          <StatusChip label={badge.label} tone={badge.tone} size="sm" />
        </Row>
        <Text tone="muted">{`${formatDateRange(enquiry.dateFrom, enquiry.dateTo)} · ${enquiry.guestEstimate} guests`}</Text>
        {enquiry.assignedUserId ? null : <StatusChip label="Unassigned" tone="warning" size="sm" />}
      </Stack>
    </Card>
  );
}

function ListLoading() {
  return (
    <Stack gap={2} testID="staff-enquiries-loading">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </Stack>
  );
}

function ListError({ error, onRetry }: { readonly error: unknown; readonly onRetry: () => void }) {
  const router = useRouter();
  if (isAppError(error) && error.code === "network_error")
    return <OfflineState onRetry={onRetry} />;
  if (isAppError(error) && error.code === "unauthenticated") {
    return (
      <EmptyState
        icon="lock"
        title="Sign in to view enquiries"
        action={{ label: "Sign in", onPress: () => router.replace("/sign-in") }}
      />
    );
  }
  if (isAppError(error) && error.code === "forbidden")
    return <EmptyState icon="lock" title="Not available for your role" />;
  return <ErrorState onRetry={onRetry} />;
}
