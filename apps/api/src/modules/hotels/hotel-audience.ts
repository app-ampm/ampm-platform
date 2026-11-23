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
 * Refuses a write that sets a hotel's internal rating or notes for a principal who may not change them
 * (403: the hotel itself is theirs to see). The profile keys a custom role may hold do not carry the
 * notes row, so this is checked on its own key.
 *
 * @example
 * requireNotesWrite(principal, request.internalNotes !== undefined);
 */
export function requireNotesWrite(principal: Principal, setsNotes: boolean): void {
  if (setsNotes && !can(toPolicyPrincipal(principal), HOTEL_NOTES_UPDATE)) {
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
