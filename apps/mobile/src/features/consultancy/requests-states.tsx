import type { ReactNode } from "react";
import { useRouter } from "expo-router";

import type { useHotelEnquiries } from "@ampm/api-client";
import { Card, EmptyState, QueryErrorState, Skeleton, Stack } from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

export interface RequestsStatesProps {
  readonly enquiries: ReturnType<typeof useHotelEnquiries>;
  /**
   * Inside D8's glass list panel on a desktop: the states are drawn flat on it (only the panel blurs).
   * On a phone they stand on the page as their own glass.
   */
  readonly inPanel?: boolean | undefined;
  /** The enquiries, once there are some. */
  readonly children: ReactNode;
}

/**
 * The enquiry list's loading, error and empty states, the same on a phone's page and in the desktop
 * list panel; the list itself once it has enquiries.
 */
export function RequestsStates({ enquiries, inPanel = false, children }: RequestsStatesProps) {
  const router = useRouter();
  const goToSignIn = useGoToSignIn();
  if (enquiries.isPending) return <ListLoading inPanel={inPanel} />;
  if (enquiries.isError)
    return (
      <QueryErrorState
        error={enquiries.error}
        onRetry={() => void enquiries.refetch()}
        onSignIn={goToSignIn}
        signIn={{ title: "Sign in to view your requests" }}
        blur={!inPanel}
      />
    );
  if (enquiries.items.length === 0)
    return <NoRequests onBrowse={() => router.push("/hotels")} blur={!inPanel} />;
  return children;
}

/** No request yet: how one starts, and the way to the hotels as the screen's gold action. */
function NoRequests({ onBrowse, blur }: { readonly onBrowse: () => void; readonly blur: boolean }) {
  return (
    <EmptyState
      icon="inbox"
      title="No hotel requests yet"
      description="Open a hotel and tap “Request hotel assistance” to start one."
      action={{ label: "Browse hotels", onPress: onBrowse, variant: "primary" }}
      blur={blur}
    />
  );
}

/** Rows the size of enquiry rows: on their own glass card on a phone, straight on the desktop panel. */
function ListLoading({ inPanel }: { readonly inPanel: boolean }) {
  const rows = (
    <Stack gap={2} testID={inPanel ? "requests-loading" : undefined}>
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </Stack>
  );
  if (inPanel) return rows;
  return (
    <Card padding="sm" testID="requests-loading">
      {rows}
    </Card>
  );
}
