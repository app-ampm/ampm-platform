import { useState, type ReactNode } from "react";
import { useCanGoBack, useRouter } from "expo-router";

import { useHotelInfoRequests, type CursorListResult } from "@ampm/api-client";
import type { HotelInfoRequestSummaryView } from "@ampm/core";
import {
  Card,
  DataTable,
  EmptyState,
  LoadMore,
  QueryErrorState,
  Screen,
  ScreenHeader,
  Skeleton,
  Stack,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import {
  InfoRequestFilters,
  isFiltered,
  NO_REQUEST_FILTERS,
  type RequestFilters,
} from "./info-requests-filters";
import { useRequestColumns } from "./info-requests-table.columns";
import { requestRowSummary } from "./info-requests.format";
import { RequestDetailSheet } from "./request-detail-sheet";
import { useInfoRequestPermissions } from "./use-info-request-permissions";

type Row = HotelInfoRequestSummaryView;
type Requests = CursorListResult<Row>;

function RequestsLoading() {
  return (
    <Stack gap={2} testID="requests-loading">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </Stack>
  );
}

/** The queue in T4's table on glass, and its next-page footer. */
function RequestsTable({
  requests,
  onOpen,
}: {
  readonly requests: Requests;
  readonly onOpen: (row: Row) => void;
}) {
  const columns = useRequestColumns();
  return (
    <Stack gap={4}>
      <Card padding="sm" className="lg:px-6" testID="requests-table">
        <DataTable
          columns={columns}
          rows={requests.items}
          keyExtractor={(request) => request.id}
          onRowPress={onOpen}
          rowAccessibilityLabel={requestRowSummary}
        />
      </Card>
      <LoadMore
        hasMore={requests.hasMore}
        loading={requests.isLoadingMore}
        failed={requests.loadMoreError}
        onLoadMore={requests.loadMore}
        testID="requests-load-more"
      />
    </Stack>
  );
}

interface BodyProps {
  readonly requests: Requests;
  readonly filtered: boolean;
  readonly onOpen: (row: Row) => void;
  readonly onClearFilters: () => void;
}

function RequestsBody({ requests, filtered, onOpen, onClearFilters }: BodyProps) {
  const goToSignIn = useGoToSignIn();
  if (requests.isPending) return <RequestsLoading />;
  if (requests.isError) {
    return (
      <QueryErrorState
        error={requests.error}
        onRetry={requests.refetch}
        onSignIn={goToSignIn}
        signIn={{ title: "Sign in to see the information requests" }}
        notFound={{ title: "Information requests are not open to your role", icon: "lock" }}
      />
    );
  }
  if (requests.items.length > 0) return <RequestsTable requests={requests} onOpen={onOpen} />;
  if (filtered) {
    return (
      <EmptyState
        icon="filter"
        title="No requests match these filters"
        action={{ label: "Show every request", onPress: onClearFilters }}
        testID="requests-empty-filtered"
      />
    );
  }
  return (
    <EmptyState
      icon="inbox"
      title="No information requests yet"
      description="Send one from a hotel's record, or invite a new hotel from the catalogue."
      testID="requests-empty"
    />
  );
}

function RequestsHeader() {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  return (
    <ScreenHeader
      eyebrow="Hotels"
      title="Information requests"
      onBack={() => (canGoBack ? router.back() : router.replace("/hotels-admin"))}
      backLabel="Back to the hotel catalogue"
    />
  );
}

/** The queue's filters, as the list asks for them: tests only for the Super Admin. */
function listQuery(filters: RequestFilters, canMakeTests: boolean) {
  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.kind ? { kind: filters.kind } : {}),
    ...(canMakeTests && filters.includeTests ? { includeTests: true } : {}),
  };
}

export interface InfoRequestsScreenProps {
  readonly tabBar?: ReactNode;
}

/**
 * TW-99 Information requests, the skeleton (D-188 §7; plan §8): every hotel information request, newest
 * first, 50 a page, filtered by status and round; the Super Admin may show the test requests, left out by
 * default. A row opens its hotel's record, where the request panel acts on it; a new hotel's request,
 * which has no record yet, opens on a sheet. Readers of `hotels.info_requests.read`; gated server-side.
 *
 *   <InfoRequestsScreen tabBar={<AppTabBar />} />
 */
export function InfoRequestsScreen({ tabBar }: InfoRequestsScreenProps) {
  const router = useRouter();
  const { canMakeTests, canUpdate } = useInfoRequestPermissions();
  const [filters, setFilters] = useState<RequestFilters>(NO_REQUEST_FILTERS);
  const requests = useHotelInfoRequests(listQuery(filters, canMakeTests), {
    keepPreviousData: true,
  });
  const [opened, setOpened] = useState<Row | null>(null);
  const open = (request: Row): void => {
    if (request.hotelId === null) return setOpened(request);
    router.push({
      pathname: "/hotels-admin/[hotelId]/details",
      params: { hotelId: request.hotelId },
    });
  };
  return (
    <Screen width="wide" tabBar={tabBar} header={<RequestsHeader />}>
      <Stack gap={6}>
        <InfoRequestFilters filters={filters} onChange={setFilters} showTests={canMakeTests} />
        <RequestsBody
          requests={requests}
          filtered={isFiltered(filters)}
          onOpen={open}
          onClearFilters={() => setFilters(NO_REQUEST_FILTERS)}
        />
      </Stack>
      <RequestDetailSheet
        requestId={opened?.id ?? null}
        reference={opened?.reference ?? ""}
        canUpdate={canUpdate}
        onClose={() => setOpened(null)}
      />
    </Screen>
  );
}
