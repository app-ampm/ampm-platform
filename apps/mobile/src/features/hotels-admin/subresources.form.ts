import type {
  HotelContactCreateRequest,
  HotelContactView,
  HotelVenueType,
  RoomCategoryCreateRequest,
  RoomCategoryView,
  VenueCreateRequest,
  VenueView,
} from "@ampm/core";

import {
  facilitiesToText,
  intOrNull,
  numberToText,
  textOrNull,
  textToFacilities,
  wholeNumberError,
} from "./hotel-form-fields";

/*
 * Pure form logic for a hotel's subresource editors (feature 9.1): room categories, venues and contacts.
 * Each has a draft (text as strings), the client-side checks that must pass before submit, and the
 * create/update body (the same shape serves both — the server patches what changed). The server
 * re-validates every field (bounds, email, that the child belongs to the hotel).
 */

// --- Room categories ---

export interface RoomDraft {
  readonly name: string;
  readonly roomCount: string;
  readonly maxOccupancy: string;
  readonly sizeSqm: string;
  readonly facilities: string;
  readonly description: string;
}

export function draftFromRoom(room: RoomCategoryView | null): RoomDraft {
  return {
    name: room?.name ?? "",
    roomCount: numberToText(room?.roomCount ?? null),
    maxOccupancy: numberToText(room?.maxOccupancy ?? null),
    sizeSqm: numberToText(room?.sizeSqm ?? null),
    facilities: facilitiesToText(room?.facilities ?? null),
    description: room?.description ?? "",
  };
}

export type RoomErrors = {
  readonly name: string | undefined;
  readonly roomCount: string | undefined;
  readonly maxOccupancy: string | undefined;
  readonly sizeSqm: string | undefined;
};

export function validateRoom(draft: RoomDraft): RoomErrors {
  return {
    name: draft.name.trim() === "" ? "Give the room category a name" : undefined,
    roomCount: wholeNumberError(draft.roomCount, "Rooms"),
    maxOccupancy: wholeNumberError(draft.maxOccupancy, "Max occupancy"),
    sizeSqm: wholeNumberError(draft.sizeSqm, "Size"),
  };
}

export function buildRoomBody(draft: RoomDraft): RoomCategoryCreateRequest {
  return {
    name: draft.name.trim(),
    roomCount: intOrNull(draft.roomCount),
    maxOccupancy: intOrNull(draft.maxOccupancy),
    sizeSqm: intOrNull(draft.sizeSqm),
    facilities: textToFacilities(draft.facilities),
    description: textOrNull(draft.description),
  };
}

// --- Venues ---

export interface VenueDraft {
  readonly name: string;
  readonly venueType: HotelVenueType;
  readonly isIndoor: boolean;
  readonly areaSqm: string;
  readonly capacityBanquet: string;
  readonly capacityTheatre: string;
  readonly capacityReception: string;
  readonly facilities: string;
  readonly description: string;
}

export function draftFromVenue(venue: VenueView | null): VenueDraft {
  return {
    name: venue?.name ?? "",
    venueType: venue?.venueType ?? "ballroom",
    isIndoor: venue?.isIndoor ?? true,
    areaSqm: numberToText(venue?.areaSqm ?? null),
    capacityBanquet: numberToText(venue?.capacityBanquet ?? null),
    capacityTheatre: numberToText(venue?.capacityTheatre ?? null),
    capacityReception: numberToText(venue?.capacityReception ?? null),
    facilities: facilitiesToText(venue?.facilities ?? null),
    description: venue?.description ?? "",
  };
}

export type VenueErrors = {
  readonly name: string | undefined;
  readonly areaSqm: string | undefined;
  readonly capacityBanquet: string | undefined;
  readonly capacityTheatre: string | undefined;
  readonly capacityReception: string | undefined;
};

export function validateVenue(draft: VenueDraft): VenueErrors {
  return {
    name: draft.name.trim() === "" ? "Give the venue a name" : undefined,
    areaSqm: wholeNumberError(draft.areaSqm, "Area"),
    capacityBanquet: wholeNumberError(draft.capacityBanquet, "Banquet capacity"),
    capacityTheatre: wholeNumberError(draft.capacityTheatre, "Theatre capacity"),
    capacityReception: wholeNumberError(draft.capacityReception, "Reception capacity"),
  };
}

export function buildVenueBody(draft: VenueDraft): VenueCreateRequest {
  return {
    name: draft.name.trim(),
    venueType: draft.venueType,
    isIndoor: draft.isIndoor,
    areaSqm: intOrNull(draft.areaSqm),
    capacityBanquet: intOrNull(draft.capacityBanquet),
    capacityTheatre: intOrNull(draft.capacityTheatre),
    capacityReception: intOrNull(draft.capacityReception),
    facilities: textToFacilities(draft.facilities),
    description: textOrNull(draft.description),
  };
}

// --- Contacts (RESTRICTED-CONTACT) ---

export interface ContactDraft {
  readonly name: string;
  readonly roleTitle: string;
  readonly phone: string;
  readonly email: string;
  readonly isPrimary: boolean;
}

export function draftFromContact(contact: HotelContactView | null): ContactDraft {
  return {
    name: contact?.name ?? "",
    roleTitle: contact?.roleTitle ?? "",
    phone: contact?.phone ?? "",
    email: contact?.email ?? "",
    isPrimary: contact?.isPrimary ?? false,
  };
}

export type ContactErrors = {
  readonly name: string | undefined;
  readonly email: string | undefined;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateContact(draft: ContactDraft): ContactErrors {
  const email = draft.email.trim();
  return {
    name: draft.name.trim() === "" ? "Give the contact a name" : undefined,
    email: email !== "" && !EMAIL.test(email) ? "Enter a valid email address" : undefined,
  };
}

export function buildContactBody(draft: ContactDraft): HotelContactCreateRequest {
  const email = draft.email.trim();
  return {
    name: draft.name.trim(),
    roleTitle: textOrNull(draft.roleTitle),
    phone: textOrNull(draft.phone),
    email: email === "" ? null : email.toLowerCase(),
    isPrimary: draft.isPrimary,
  };
}
