import type { ReactNode } from "react";

import { SplitPane } from "@ampm/ui";

import { EnquirySurfaceContext } from "../consultancy/enquiry-surface";

export interface EnquiriesSplitProps {
  /** From 1024: the queue beside the enquiry, which sits in T6's one detail pane. */
  readonly isSplit: boolean;
  /** The queue's slot: T6's panel from 1024, the phone's queue on the list page, or nothing. */
  readonly queue: ReactNode;
  /** The open enquiry (or its loading state). */
  readonly children: ReactNode;
}

/**
 * T6's frame: from 1024 the queue (432, T6's 430) at the left of the open enquiry, both running to the
 * taller one's foot, 14 apart; below that one column. One tree at every width (`SplitPane` keys its
 * two slots, and an empty slot stays a slot), so what is under way in the enquiry survives a tablet
 * turning or the window crossing 1024; its sections read the surface to draw flat inside the pane.
 */
export function EnquiriesSplit({ isSplit, queue, children }: EnquiriesSplitProps) {
  return (
    <SplitPane
      side={queue}
      sidePosition="start"
      sideFirstWhenStacked
      sideWidth="list"
      align="stretch"
      gap={isSplit ? 3.5 : 0}
      testID="enquiries-split"
    >
      <EnquirySurfaceContext.Provider value={isSplit ? "panel" : "page"}>
        {children}
      </EnquirySurfaceContext.Provider>
    </SplitPane>
  );
}
