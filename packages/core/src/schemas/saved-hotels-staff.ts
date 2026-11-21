import { z } from "zod";

import { cursorQuery, isoDateTime, page, uuid } from "./common.js";
import { hotelStatus } from "./hotels-admin.js";

/*
 * The STAFF read of clients' saved hotels (permission-matrix §5.3 "Saved hotels (created by clients)":
 * SA, SM, HT read; PM reads those on assigned weddings). A client builds the list while exploring hotels
 * on the discovery subscription; staff read it to follow what each client is interested in. Read-only:
 * only the client adds, annotates or removes a saved hotel. A separate model from the client's own
 * `savedHotelView` (security.md: one response model per audience); every field here is CLIENT class (the
 * hotel's name and place, the client's own note), plus the account it belongs to.
 */

/** The hotel a client saved, as the staff row names it: enough to recognise it and open its profile. */
export const savedHotelStaffHotel = z
  .object({
    id: uuid,
    name: z.string(),
    starCategory: z.string().nullable(),
    status: hotelStatus,
    destinationName: z.string(),
  })
  .strict();
export type SavedHotelStaffHotel = z.infer<typeof savedHotelStaffHotel>;

/** The client account the saved hotel belongs to. */
export const savedHotelStaffAccount = z.object({ id: uuid, name: z.string() }).strict();
export type SavedHotelStaffAccount = z.infer<typeof savedHotelStaffAccount>;

/** One hotel on one client's saved list, as staff see it. */
export const savedHotelStaffView = z
  .object({
    id: uuid,
    hotel: savedHotelStaffHotel,
    account: savedHotelStaffAccount,
    /** The client's own note on the hotel (client-authored, CLIENT class); null when they left none. */
    note: z.string().nullable(),
    savedAt: isoDateTime,
  })
  .strict();
export type SavedHotelStaffView = z.infer<typeof savedHotelStaffView>;

/**
 * `GET /hotels-admin/saved-hotels`: every client's saved hotels, newest first; one client's whole list
 * (`accountId`, the client hub); or every client who saved one hotel (`hotelId`, the hotel's staff page).
 * Cursor-paginated by saved-hotel id. A client saves a hotel once, so a hotel's list has a row per client.
 */
export const savedHotelStaffListQuery = cursorQuery.extend({
  cursor: uuid.optional(),
  accountId: uuid.optional(),
  hotelId: uuid.optional(),
});
export type SavedHotelStaffListQuery = z.infer<typeof savedHotelStaffListQuery>;

export const savedHotelStaffPage = page(savedHotelStaffView);
export type SavedHotelStaffPage = z.infer<typeof savedHotelStaffPage>;
