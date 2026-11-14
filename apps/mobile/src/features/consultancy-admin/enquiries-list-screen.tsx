import { useCallback, type ReactNode } from "react";
import { useFocusEffect, useRouter } from "expo-router";

import { useStaffEnquiries } from "@ampm/api-client";
import { Card, EmptyState, Screen, ScreenHeader, Stack, useLayoutAt } from "@ampm/ui";

import { queueEyebrow } from "./consultancy-admin.format";
import { EnquiriesSplit } from "./enquiries-split";
import { EnquiryPaneLoading } from "./enquiry-pane-loading";
import { EnquiryQueuePanel } from "./enquiry-queue-panel";
import { EnquiryQueueRow } from "./enquiry-queue-row";
import { EnquiryQueueStates } from "./enquiry-queue-states";

type EnquiriesQuery = ReturnType<typeof useStaffEnquiries>;

/**
 * The staff hotel-enquiry queue (consultancy-admin, T6): every account's enquiries, newest first. On a
 * phone and a tablet, rows in one glass panel under the page's title; tap one to open its page. From
 * 1024 the queue sits beside an open enquiry, and the open enquiry is a route: once the queue has
 * loaded, this page is replaced by the first enquiry's, whose one tree keeps a draft across 1024. A
 * top-level screen: the route passes the app's tab bar, and on wide windows the layout draws the rail.
 */
export function StaffEnquiriesListScreen({ tabBar }: { readonly tabBar?: ReactNode }) {
  const isSplit = useLayoutAt("lg");
  const enquiries = useStaffEnquiries();
  useOpenFirstBesideQueue(isSplit, enquiries.data?.items[0]?.id);
  return (
    <Screen
      width="wide"
      tabBar={tabBar}
      header={isSplit ? null : <QueueHeader enquiries={enquiries} />}
    >
      <EnquiriesSplit
        isSplit={isSplit}
        queue={
          isSplit ? <EnquiryQueuePanel openId={undefined} /> : <QueuePage enquiries={enquiries} />
        }
      >
        {isSplit ? <NothingOpen enquiries={enquiries} /> : null}
      </EnquiriesSplit>
    </Screen>
  );
}

/**
 * From 1024, opens the first enquiry in the queue at its own address, in place of this page (no
 * history entry): the address names what is open, a refresh reopens it, and the queue beside it
 * changes the selection in place. Only while this page is focused, so a queue page left under a
 * pushed enquiry never redirects the screen above it when the window widens.
 */
function useOpenFirstBesideQueue(isSplit: boolean, firstId: string | undefined): void {
  const router = useRouter();
  useFocusEffect(
    useCallback(() => {
      if (isSplit && firstId) router.replace(`/enquiries/${firstId}`);
    }, [isSplit, firstId, router]),
  );
}

/**
 * The pane beside the queue while nothing is open: the enquiry's shapes while the queue loads (or the
 * first enquiry's page is on its way), and a plain word when there is nothing to open.
 */
function NothingOpen({ enquiries }: { readonly enquiries: EnquiriesQuery }) {
  if (enquiries.isError)
    return (
      <EmptyState
        icon="inbox"
        title="No enquiry open"
        description="Nothing can open here until the queue loads."
        testID="enquiry-none-open"
      />
    );
  if (enquiries.isSuccess && enquiries.data.items.length === 0)
    return (
      <EmptyState
        icon="inbox"
        title="No enquiry open"
        description="An enquiry opens here once a client asks AMPM to check a hotel."
        testID="enquiry-none-open"
      />
    );
  return <EnquiryPaneLoading />;
}

/** The page's title on a phone and a tablet, with the open count over it once the queue has rows. */
function QueueHeader({ enquiries }: { readonly enquiries: EnquiriesQuery }) {
  const hasRows = enquiries.isSuccess && enquiries.data.items.length > 0;
  return (
    <ScreenHeader eyebrow={hasRows ? queueEyebrow(enquiries.data) : undefined} title="Enquiries" />
  );
}

/** The queue on its own page: rows in one glass panel; a row opens its enquiry's page. */
function QueuePage({ enquiries }: { readonly enquiries: EnquiriesQuery }) {
  const router = useRouter();
  return (
    <EnquiryQueueStates enquiries={enquiries}>
      {(page) => (
        <Card padding="sm" className="md:p-5.5">
          <Stack gap={2}>
            {page.items.map((enquiry) => (
              <EnquiryQueueRow
                key={enquiry.id}
                enquiry={enquiry}
                onPress={() => router.push(`/enquiries/${enquiry.id}`)}
              />
            ))}
          </Stack>
        </Card>
      )}
    </EnquiryQueueStates>
  );
}
