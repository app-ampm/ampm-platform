import type { ReactNode } from "react";
import { useRouter } from "expo-router";

import { useHotelEnquiries } from "@ampm/api-client";
import { isAppError } from "@ampm/core";
import {
  Card,
  EmptyState,
  ErrorState,
  OfflineState,
  Screen,
  ScreenHeader,
  Skeleton,
  Stack,
} from "@ampm/ui";

import { RequestRow } from "./request-row";

/**
 * CP: the client's hotel-assistance requests (D8 "Enquiries"), each a row on one glass panel; tap one
 * to see its progress. A top-level screen: the app's route supplies the tab bar.
 */
export function RequestsListScreen({ tabBar }: { readonly tabBar?: ReactNode }) {
  const router = useRouter();
  const enquiries = useHotelEnquiries();
  return (
    <Screen
      width="content"
      tabBar={tabBar}
      header={<ScreenHeader title="Enquiries" onBack={() => router.back()} />}
    >
      <RequestsBody enquiries={enquiries} />
    </Screen>
  );
}

function RequestsBody({ enquiries }: { readonly enquiries: ReturnType<typeof useHotelEnquiries> }) {
  const router = useRouter();
  if (enquiries.isPending) return <ListLoading />;
  if (enquiries.isError)
    return <ListError error={enquiries.error} onRetry={() => void enquiries.refetch()} />;
  if (enquiries.data.items.length === 0) {
    return (
      <EmptyState
        icon="inbox"
        title="No hotel requests yet"
        description="Open a hotel and tap “Request hotel assistance” to start one."
        action={{
          label: "Browse hotels",
          onPress: () => router.push("/hotels"),
          variant: "primary",
        }}
      />
    );
  }
  return (
    <Card padding="sm">
      <Stack gap={2}>
        {enquiries.data.items.map((enquiry) => (
          <RequestRow
            key={enquiry.id}
            enquiry={enquiry}
            onOpen={() => router.push(`/portal/requests/${enquiry.id}`)}
          />
        ))}
      </Stack>
    </Card>
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
        title="Sign in to view your requests"
        action={{
          label: "Sign in",
          onPress: () => router.replace("/sign-in"),
          variant: "primary",
        }}
      />
    );
  }
  return <ErrorState onRetry={onRetry} />;
}

function ListLoading() {
  return (
    <Card padding="sm" testID="requests-loading">
      <Stack gap={2}>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </Stack>
    </Card>
  );
}
