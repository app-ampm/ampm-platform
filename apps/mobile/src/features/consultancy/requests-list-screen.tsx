import type { ReactNode } from "react";
import { useRouter } from "expo-router";

import { useHotelEnquiries } from "@ampm/api-client";
import { Card, EmptyState, QueryErrorState, Screen, ScreenHeader, Skeleton, Stack } from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

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
  const goToSignIn = useGoToSignIn();
  if (enquiries.isPending) return <ListLoading />;
  if (enquiries.isError)
    return (
      <QueryErrorState
        error={enquiries.error}
        onRetry={() => void enquiries.refetch()}
        onSignIn={goToSignIn}
        signIn={{ title: "Sign in to view your requests" }}
      />
    );
  if (enquiries.data.items.length === 0)
    return <NoRequests onBrowse={() => router.push("/hotels")} />;
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

/** No request yet: how one starts, and the way to the hotels as the screen's gold action. */
function NoRequests({ onBrowse }: { readonly onBrowse: () => void }) {
  return (
    <EmptyState
      icon="inbox"
      title="No hotel requests yet"
      description="Open a hotel and tap “Request hotel assistance” to start one."
      action={{ label: "Browse hotels", onPress: onBrowse, variant: "primary" }}
    />
  );
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
