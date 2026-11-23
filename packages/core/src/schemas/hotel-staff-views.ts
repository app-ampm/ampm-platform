import { z } from "zod";

import { isoDateTime, page, uuid } from "./common.js";
import {
  destinationView,
  facilityLabels,
  hotelContactView,
  hotelStatus,
  roomCategoryView,
  venueView,
} from "./hotels-admin.js";

/*
 * The STAFF hotel as `/hotels-admin/hotels` returns it: one model per audience (D-171). §5.3 of the
 * permission matrix spreads a hotel's columns over three rows: "Hotel profiles, client fields" (every
 * staff role reads it), "Hotel internal rating and notes" (RESTRICTED-NOTES) and "Hotel contacts"
 * (RESTRICTED-CONTACT), which most roles may not read. So the profile goes to every reader of the
 * first row, and each restricted group only to a principal whose grants reach its row. A group outside
 * them is absent from the response, never null and never flagged (security.md); the API picks the model
 * from the principal's grants, a custom role's included, never from role codes. The client discovery
 * views in `hotels.ts` are a separate, PUBLIC+CLIENT-only model.
 */

/** PUBLIC, CLIENT and INTERNAL profile columns: every holder of `hotels.hotel_profiles_client_fields.read`. */
const hotelProfileFields = {
  id: uuid,
  destinationId: uuid,
  name: z.string(),
  slug: z.string(),
  brand: z.string().nullable(),
  starCategory: z.string().nullable(),
  address: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  descriptionClient: z.string().nullable(),
  website: z.string().nullable(),
  status: hotelStatus,
  demoVisible: z.boolean(),
  publicShowcase: z.boolean(),
  totalRooms: z.number().int().nullable(),
  streetViewRef: z.string().nullable(),
  lastVerifiedAt: isoDateTime.nullable(),
  facilities: facilityLabels.nullable(),
};

/** RESTRICTED-NOTES, the "Hotel internal rating and notes" row: `hotels.hotel_internal_rating_notes.read`. */
const hotelInternalNoteFields = {
  internalRating: z.number().int().nullable(),
  internalNotes: z.string().nullable(),
};

/**
 * RESTRICTED-CONTACT, the "Hotel contacts" row: `hotels.hotel_contacts.read` reaching the hotel. A
 * Hospitality Lead's "R (a)" reaches only hotels of weddings they are a member of, and no wedding names
 * a catalogue hotel yet (module E), so they get none here.
 */
const hotelContactListFields = { contacts: z.array(hotelContactView) };

/** The detail's own parts, for every profile reader: the destination, room categories and venues. */
const hotelDetailFields = {
  ...hotelProfileFields,
  destination: destinationView,
  rooms: z.array(roomCategoryView),
  venues: z.array(venueView),
};

/**
 * A hotel in the staff list as every profile reader gets it (CD, VC, RG, HL and FA among the system
 * roles): no restricted class. The list never carries contacts.
 */
export const hotelStaffView = z.object(hotelProfileFields).strict();
export type HotelStaffView = z.infer<typeof hotelStaffView>;

/** A hotel in the staff list for a reader of its internal rating and notes (SA, SM, HT, PM). */
export const hotelStaffNotesView = z
  .object({ ...hotelProfileFields, ...hotelInternalNoteFields })
  .strict();
export type HotelStaffNotesView = z.infer<typeof hotelStaffNotesView>;

/**
 * One hotel of `GET /hotels-admin/hotels`: the model of the reader's audience. Narrow it with `in`.
 *
 * @example
 * const rating = "internalRating" in hotel ? hotel.internalRating : undefined;
 */
export const hotelStaffListItem = z.union([hotelStaffNotesView, hotelStaffView]);
export type HotelStaffListItem = z.infer<typeof hotelStaffListItem>;

/** A page of the staff catalogue (`{ items, nextCursor }`), every item in the reader's model. */
export const hotelStaffPage = page(hotelStaffListItem);
export type HotelStaffPage = z.infer<typeof hotelStaffPage>;

/** The staff hotel detail as every profile reader gets it: no restricted class. */
export const hotelStaffDetailView = z.object(hotelDetailFields).strict();
export type HotelStaffDetailView = z.infer<typeof hotelStaffDetailView>;

/** The staff hotel detail for a reader of the internal rating and notes, not of the contacts. */
export const hotelStaffDetailNotesView = z
  .object({ ...hotelDetailFields, ...hotelInternalNoteFields })
  .strict();
export type HotelStaffDetailNotesView = z.infer<typeof hotelStaffDetailNotesView>;

/** The staff hotel detail for a reader of the contacts, not of the internal rating and notes. */
export const hotelStaffDetailContactsView = z
  .object({ ...hotelDetailFields, ...hotelContactListFields })
  .strict();
export type HotelStaffDetailContactsView = z.infer<typeof hotelStaffDetailContactsView>;

/** The staff hotel detail for a reader of both restricted rows (SA, SM, HT, PM). */
export const hotelStaffDetailFullView = z
  .object({ ...hotelDetailFields, ...hotelInternalNoteFields, ...hotelContactListFields })
  .strict();
export type HotelStaffDetailFullView = z.infer<typeof hotelStaffDetailFullView>;

/**
 * What `GET`, `POST` and `PATCH /hotels-admin/hotels…` return: the detail model of the reader's
 * audience. Each model is strict, so a payload matches exactly one; narrow it with `in`.
 *
 * @example
 * if ("contacts" in hotel) showContacts(hotel.contacts);
 */
export const hotelStaffDetail = z.union([
  hotelStaffDetailFullView,
  hotelStaffDetailNotesView,
  hotelStaffDetailContactsView,
  hotelStaffDetailView,
]);
export type HotelStaffDetail = z.infer<typeof hotelStaffDetail>;
