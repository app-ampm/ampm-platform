import type { HotelCuisineOptionsView, MeResponse } from "@ampm/core";

import {
  destinationListItemFixture,
  HOTEL_ID,
  hotelCuisineOptionsFixture,
  hotelStaffDetailViewFixture,
  ok,
  routedFetch,
  type FetchFn,
} from "./hotels-admin.test-utils";

/*
 * Test helpers for the hotel profile editor: the routes the sheet calls, answering with synthetic
 * fixtures and keeping the bodies it sends. Imported by tests only.
 */

/** The bodies the editor sent: a create's and an update's. */
export interface CapturedSave {
  created?: unknown;
  updated?: unknown;
}

export interface ProfileEditorFetchOptions {
  /** The person whose grants decide the internal fields (D-171); no `/me` route when absent. */
  readonly me?: MeResponse | undefined;
  /** The cuisine choices the options route returns. */
  readonly cuisines?: HotelCuisineOptionsView | undefined;
}

/**
 * The editor's routes: the destinations (one, in India), the cuisine options, create and update.
 *
 *   const captured: CapturedSave = {};
 *   await renderWithApi(<HotelProfileEditSheet open hotel={null} onClose={noop} />, profileEditorFetch(captured));
 */
export function profileEditorFetch(
  captured: CapturedSave,
  { me, cuisines = hotelCuisineOptionsFixture() }: ProfileEditorFetchOptions = {},
): FetchFn {
  return routedFetch({
    ...(me ? { "/me": () => ok(me) } : {}),
    "/hotels-admin/destinations": () => ok({ items: [destinationListItemFixture()] }),
    "/hotels-admin/cuisine-options": () => ok(cuisines),
    "/hotels-admin/hotels": (init) => {
      captured.created = JSON.parse(String(init?.body));
      return ok(hotelStaffDetailViewFixture());
    },
    [`/hotels-admin/hotels/${HOTEL_ID}`]: (init) => {
      captured.updated = JSON.parse(String(init?.body));
      return ok(hotelStaffDetailViewFixture());
    },
  });
}
