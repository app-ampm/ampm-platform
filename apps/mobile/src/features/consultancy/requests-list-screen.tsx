import type { ReactNode } from "react";
import { useRouter } from "expo-router";

import { useHotelEnquiries } from "@ampm/api-client";
import { Card, LoadMore, Screen, ScreenHeader, Stack, useLayoutAt } from "@ampm/ui";

import { EnquiryDetail } from "./enquiry-detail";
import { EnquiryDetailLoading } from "./enquiry-detail-loading";
import { RequestRow } from "./request-row";
import { RequestsSplit } from "./requests-split";
import { RequestsStates } from "./requests-states";

/**
 * CP: the client's hotel-assistance requests (D8 "Enquiries"). On a phone and a tablet, each a row on
 * one glass panel; tap one to see its progress. From 1024, D8's list beside the most recent enquiry. A
 * top-level screen: the app's route supplies the tab bar. The two differ in what they show (a phone has
 * no enquiry open here), so they are two trees; the open enquiry's own page keeps one (`RequestDetailScreen`).
 */
export function RequestsListScreen({ tabBar }: { readonly tabBar?: ReactNode }) {
  const isSplit = useLayoutAt("lg");
  if (isSplit) return <RequestsSplitPage tabBar={tabBar} />;
  return <RequestsPage tabBar={tabBar} />;
}

/**
 * D8 with no enquiry in the address: the most recent (the API lists the newest first) opens beside
 * the list without changing the address, so this page always shows the latest. Choosing another goes
 * to its own address; choosing this one stays put.
 */
function RequestsSplitPage({ tabBar }: { readonly tabBar?: ReactNode }) {
  const enquiries = useHotelEnquiries();
  const openId = enquiries.items[0]?.id;
  return (
    <Screen width="split" tabBar={tabBar}>
      <RequestsSplit isSplit openId={openId}>
        {openId ? <EnquiryDetail key={openId} enquiryId={openId} /> : null}
        {!openId && enquiries.isPending ? <EnquiryDetailLoading /> : null}
      </RequestsSplit>
    </Screen>
  );
}

/** The list on its own page, a back button above it. */
function RequestsPage({ tabBar }: { readonly tabBar?: ReactNode }) {
  const router = useRouter();
  const enquiries = useHotelEnquiries();
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
