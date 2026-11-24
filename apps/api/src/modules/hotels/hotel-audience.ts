import { errors } from "@ampm/core";
import { can } from "@ampm/policy";

import { type Principal, toPolicyPrincipal } from "../../policy/principal.types.js";

/*
 * Who reads which part of a staff hotel (D-171). §5.3 of the permission matrix gives a hotel's profile,
 * its internal rating and notes, and its contacts three rows with different readers, so the staff hotel
 * is one response model per audience (`hotel-staff-views.ts` in @ampm/core). The audience is decided
 * from the principal's grants through @ampm/policy, a custom role's resolved grants included (D-164),
 * never from role codes.
 */

/** RESTRICTED-NOTES: the "Hotel internal rating and notes" row (§10 also names it `…read_internal_notes`). */
export const HOTEL_NOTES_READ = "hotels.hotel_internal_rating_notes.read";
export const HOTEL_NOTES_UPDATE = "hotels.hotel_internal_rating_notes.update";
/** RESTRICTED-CONTACT: the "Hotel contacts" row (§10 also names it `…read_contacts`). */
export const HOTEL_CONTACTS_READ = "hotels.hotel_contacts.read";
/** Reading a hotel's profile, the INTERNAL name variants and booking terms included. */
export const HOTEL_PROFILE_READ = "hotels.hotel_profiles_client_fields.read";
/** Changing an existing hotel's profile: what an import row that updates a hotel needs (D-181). */
export const HOTEL_PROFILE_UPDATE = "hotels.hotel_profiles_client_fields.update";
/** Creating a destination, as `POST /hotels-admin/destinations` asks. */
export const DESTINATION_CREATE = "hotels.destinations.create";
/** Adding a hotel image, as the media routes ask. */
export const HOTEL_MEDIA_CREATE = "hotels.hotel_media_rights_status.create";
/** A hotel's room categories and venues: what the staff routes and the rooms and venues imports ask. */
export const ROOMS_VENUES_CREATE = "hotels.room_categories_venues.create";
export const ROOMS_VENUES_UPDATE = "hotels.room_categories_venues.update";
export const ROOMS_VENUES_READ = "hotels.room_categories_venues.read";
/** Changing a hotel contact: what demoting the current primary contact needs (D-178). */
export const HOTEL_CONTACTS_UPDATE = "hotels.hotel_contacts.update";

/**
 * The restricted parts of a staff hotel a principal reads, beyond the profile every reader of
 * `hotels.hotel_profiles_client_fields.read` gets.
 *
 * @example
 * const audience: HotelAudience = { notes: true, contacts: false }; // a custom role's notes reader
 */
export interface HotelAudience {
  /** `hotels.hotel_internal_rating_notes.read`: the internal rating and notes. */
  readonly notes: boolean;
  /** `hotels.hotel_contacts.read`, reaching the hotel: its contacts. */
  readonly contacts: boolean;
}

/**
 * The principal's audience for a catalogue hotel, decided as the guard decides a key. With no wedding
 * to name, a grant scoped to the person's weddings reaches none: a Hospitality Lead's "R (a)" on the
 * contacts opens only hotels of weddings they are a member of, and no wedding names a catalogue hotel
 * until module E lands, so they get no contacts here; that module passes the hotel's weddings as targets.
 *
 * @example
 * hotelAudienceOf(principal); // SA, SM, HT, PM: { notes: true, contacts: true }; CD, HL, FA: neither
 */
export function hotelAudienceOf(principal: Principal): HotelAudience {
  const caller = toPolicyPrincipal(principal);
  return { notes: can(caller, HOTEL_NOTES_READ), contacts: can(caller, HOTEL_CONTACTS_READ) };
}

/**
 * Whether the principal may change a hotel's internal rating and notes: the profile keys a custom role
 * may hold do not carry the notes row, so it is decided on its own key.
 *
 * @example
 * canWriteNotes(staffPrincipal(["HT"])); // true
 */
export function canWriteNotes(principal: Principal): boolean {
  return can(toPolicyPrincipal(principal), HOTEL_NOTES_UPDATE);
}

/**
 * What a hotel import's uploader may do and read beyond the create key the route asks for (D-181). Each
 * is its own key, as the dedicated routes ask it, so a custom role's rows are held to the same keys:
 * change an existing hotel, set the internal rating or notes, create a destination, add an image; and
 * read a stored hotel's profile and notes, so a dry run never compares a cell with a value its uploader
 * may not read.
 */
export interface ImportGrants {
  readonly canUpdate: boolean;
  readonly canWriteNotes: boolean;
  readonly canCreateDestinations: boolean;
  readonly canAddMedia: boolean;
  readonly readsProfiles: boolean;
  readonly readsNotes: boolean;
}

/**
 * The import grants of a principal, decided from its grants alone (D-164).
 *
 * @example
 * importGrantsOf(staffPrincipal([], ["hotels.hotel_profiles_client_fields.create:all"])); // all false
 */
export function importGrantsOf(principal: Principal): ImportGrants {
  const caller = toPolicyPrincipal(principal);
  return {
    canUpdate: can(caller, HOTEL_PROFILE_UPDATE),
    canWriteNotes: can(caller, HOTEL_NOTES_UPDATE),
    canCreateDestinations: can(caller, DESTINATION_CREATE),
    canAddMedia: can(caller, HOTEL_MEDIA_CREATE),
    readsProfiles: can(caller, HOTEL_PROFILE_READ),
    readsNotes: can(caller, HOTEL_NOTES_READ),
  };
}

/**
 * What a rooms or venues import's uploader may do and read (D-181): a row that creates needs the create
 * key, one that changes a stored room or venue the update key, and one that names a stored room or venue
 * at all the read key, so a preview never compares a cell with a row its uploader may not read.
 */
export interface ChildImportGrants {
  readonly canCreate: boolean;
  readonly canUpdate: boolean;
  readonly readsRows: boolean;
}

/**
 * The rooms and venues import grants of a principal, decided from its grants alone (D-164).
 *
 * @example
 * childImportGrantsOf(staffPrincipal(["HT"])); // { canCreate: true, canUpdate: true, readsRows: true }
 */
export function childImportGrantsOf(principal: Principal): ChildImportGrants {
  const caller = toPolicyPrincipal(principal);
  return {
    canCreate: can(caller, ROOMS_VENUES_CREATE),
    canUpdate: can(caller, ROOMS_VENUES_UPDATE),
    readsRows: can(caller, ROOMS_VENUES_READ),
  };
}

/**
 * Refuses a contact write that would demote the hotel's current primary contact for a principal who may
 * not change contacts (403: the hotel is theirs to see). The create route asks only the create key.
 *
 * @example
 * requireContactsUpdate(principal); // before demoting the current primary
 */
export function requireContactsUpdate(principal: Principal): void {
  if (!can(toPolicyPrincipal(principal), HOTEL_CONTACTS_UPDATE)) {
    throw errors.forbidden(
      "Making this the primary contact changes the current one, and you cannot change contacts",
    );
  }
}

/**
 * Refuses a write that sets a hotel's internal rating or notes for a principal who may not change them
 * (403: the hotel itself is theirs to see).
 *
 * @example
 * requireNotesWrite(principal, request.internalNotes !== undefined);
 */
export function requireNotesWrite(principal: Principal, setsNotes: boolean): void {
  if (setsNotes && !canWriteNotes(principal)) {
    throw errors.forbidden("You cannot change a hotel's internal rating or notes");
  }
}

/**
 * Refuses a contact edit by a principal who cannot read the hotel's contacts: the edit answers with the
 * whole contact, fields the caller never sent included, so for them it is as absent as a missing one.
 *
 * @example
 * requireContactsRead(principal); // before updating a contact
 */
export function requireContactsRead(principal: Principal): void {
  if (!hotelAudienceOf(principal).contacts) throw errors.notFound("No such hotel contact");
}
