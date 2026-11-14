import { useCallback, type ReactNode } from "react";
import { useFocusEffect, useRouter } from "expo-router";

import { useHotelEnquiries } from "@ampm/api-client";
import { Card, EmptyState, LoadMore, Screen, ScreenHeader, Stack, useLayoutAt } from "@ampm/ui";

import { EnquiryDetailLoading } from "./enquiry-detail-loading";
import { RequestRow } from "./request-row";
import { RequestsSplit } from "./requests-split";
import { RequestsStates } from "./requests-states";

type Enquiries = ReturnType<typeof useHotelEnquiries>;

/**
 * CP: the client's hotel-assistance requests (D8 "Enquiries"). On a phone and a tablet, each a row on
 * one glass panel; tap one to see its progress. From 1024 D8 sets the list beside an open enquiry, and
 * the open enquiry is a route: once the list has loaded, this page is replaced by the most recent
 * enquiry's (the API lists the newest first), whose one tree keeps what the client has under way
 * across 1024. A top-level screen: the app's route supplies the tab bar.
 */
export function RequestsListScreen({ tabBar }: { readonly tabBar?: ReactNode }) {
  const isSplit = useLayoutAt("lg");
  const enquiries = useHotelEnquiries();
  useOpenNewestBesideList(isSplit, enquiries.items[0]?.id);
  if (isSplit) return <RequestsSplitPage tabBar={tabBar} enquiries={enquiries} />;
  return <RequestsPage tabBar={tabBar} enquiries={enquiries} />;
}

/**
 * From 1024, opens the most recent enquiry at its own address in place of this page (no history
 * entry), so the address names what is open and a refresh reopens it. Only while this page is focused,
 * so a list left under a pushed enquiry never redirects the screen above it when the window widens.
 */
function useOpenNewestBesideList(isSplit: boolean, newestId: string | undefined): void {
  const router = useRouter();
  useFocusEffect(
    useCallback(() => {
      if (isSplit && newestId) router.replace(`/portal/requests/${newestId}`);
    }, [isSplit, newestId, router]),
  );
}

/** D8 before an enquiry opens: the list panel, and beside it the enquiry's shapes or a plain word. */
function RequestsSplitPage({
  tabBar,
  enquiries,
}: {
  readonly tabBar?: ReactNode;
  readonly enquiries: Enquiries;
}) {
  return (
    <Screen width="split" tabBar={tabBar}>
      <RequestsSplit isSplit openId={undefined}>
        <NothingOpen enquiries={enquiries} />
      </RequestsSplit>
    </Screen>
  );
}

/** Nothing to open (no request yet, or the list did not load); otherwise the enquiry on its way. */
function NothingOpen({ enquiries }: { readonly enquiries: Enquiries }) {
  const isEmpty = !enquiries.isPending && !enquiries.isError && enquiries.items.length === 0;
  if (!enquiries.isError && !isEmpty) return <EnquiryDetailLoading />;
  return (
    <EmptyState
      icon="inbox"
      title="No request open"
      description={
        enquiries.isError
          ? "Nothing can open here until your requests load."
          : "A request opens here once you ask AMPM to check a hotel."
      }
      testID="request-none-open"
    />
  );
}

/** The list on its own page, a back button above it. */
function RequestsPage({
  tabBar,
  enquiries,
}: {
  readonly tabBar?: ReactNode;
  readonly enquiries: Enquiries;
}) {
  const router = useRouter();
  return (
    <Screen
      width="content"
      tabBar={tabBar}
      header={<ScreenHeader title="Enquiries" onBack={() => router.back()} />}
    >
      <RequestsStates enquiries={enquiries}>
        <Card padding="sm">
          <Stack gap={2}>
            {enquiries.items.map((enquiry) => (
              <RequestRow
                key={enquiry.id}
                enquiry={enquiry}
                onOpen={() => router.push(`/portal/requests/${enquiry.id}`)}
              />
            ))}
            <LoadMore
              hasMore={enquiries.hasMore}
              loading={enquiries.isLoadingMore}
              failed={enquiries.loadMoreError}
              onLoadMore={enquiries.loadMore}
              testID="requests-load-more"
            />
          </Stack>
        </Card>
      </RequestsStates>
    </Screen>
  );
}
