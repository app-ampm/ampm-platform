import type { ReactNode } from "react";
import { useRouter } from "expo-router";

import { useHotelEnquiries } from "@ampm/api-client";
import { SplitPane } from "@ampm/ui";

import { EnquirySurfaceContext } from "./enquiry-surface";
import { RequestsPanel } from "./requests-panel";

export interface RequestsSplitProps {
  /** From 1024: the list panel beside the enquiry, which sits in D8's one detail panel. */
  readonly isSplit: boolean;
  /** The enquiry shown, selected in the list. */
  readonly openId: string | undefined;
  /** The open enquiry (or its loading state). */
  readonly children: ReactNode;
}

/**
 * The list column. Choosing an enquiry changes the open one in place, at its own address: on an
 * enquiry's page the route's id changes (no new screen, so the list keeps its scroll and Back does not
 * walk through every enquiry viewed); on the list's own page, before the newest has opened, that page
 * is replaced. Choosing the enquiry already open does nothing.
 */
function RequestsSide({ openId }: { readonly openId: string | undefined }) {
  const router = useRouter();
  const enquiries = useHotelEnquiries();
  const onOpen = (id: string): void => {
    if (id === openId) return;
    if (openId === undefined) router.replace(`/portal/requests/${id}`);
    else router.setParams({ id });
  };
  return <RequestsPanel enquiries={enquiries} selectedId={openId} onOpen={onOpen} />;
}

/**
 * D8's frame for the open enquiry: from 1024 the enquiries' list panel (384) at its left, both running
 * to the taller one's foot; below that the enquiry alone, as a phone's page. One tree at every width
 * (`SplitPane` keeps its main column keyed, and the list's slot is empty below 1024), so the enquiry
 * keeps its state when a tablet turns or the window crosses 1024; its sections read the surface.
 */
export function RequestsSplit({ isSplit, openId, children }: RequestsSplitProps) {
  return (
    <SplitPane
      side={isSplit ? <RequestsSide openId={openId} /> : null}
      sidePosition="start"
      sideWidth="lg"
      align="stretch"
      gap={isSplit ? 4.5 : 0}
      testID="requests-split"
    >
      <EnquirySurfaceContext.Provider value={isSplit ? "panel" : "page"}>
        {children}
      </EnquirySurfaceContext.Provider>
    </SplitPane>
  );
}
