import { describe, expect, it } from "vitest";

import { staffPrincipal } from "../../policy/testing/staff-principal.js";
import {
  hotelAudienceOf,
  importGrantsOf,
  requireContactsRead,
  requireNotesWrite,
} from "./hotel-audience.js";

const WEDDING = "0192f3a0-7d3e-7b1a-9c2f-0000000000a1";
const BOTH = { notes: true, contacts: true };
const NEITHER = { notes: false, contacts: false };

describe("hotelAudienceOf (D-171)", () => {
  it("gives the Super Admin, Sales, the Hotel team and a Project Manager both restricted groups", () => {
    for (const role of ["SA", "SM", "HT", "PM"] as const) {
      expect(hotelAudienceOf(staffPrincipal([role]))).toEqual(BOTH);
    }
  });

  it("gives Creative, Vendors, Registration and Finance neither", () => {
    for (const role of ["CD", "VC", "RG", "FA"] as const) {
      expect(hotelAudienceOf(staffPrincipal([role]))).toEqual(NEITHER);
    }
  });

  it("gives a Hospitality Lead no contacts on a catalogue hotel, even on a wedding (R (a))", () => {
    expect(hotelAudienceOf(staffPrincipal(["HL"], [], [WEDDING]))).toEqual(NEITHER);
  });

  it("D-164: decides a custom role from its grants alone", () => {
    const contacts = staffPrincipal([], ["hotels.hotel_contacts.read:all"]);
    expect(hotelAudienceOf(contacts)).toEqual({ notes: false, contacts: true });
    const notes = staffPrincipal([], ["hotels.hotel_internal_rating_notes.read:all"]);
    expect(hotelAudienceOf(notes)).toEqual({ notes: true, contacts: false });
    const scoped = staffPrincipal([], ["hotels.hotel_contacts.read:assigned"], [WEDDING]);
    expect(hotelAudienceOf(scoped)).toEqual(NEITHER);
  });

  it("adds a custom role's grants to a system role's", () => {
    const creative = staffPrincipal(["CD"], ["hotels.hotel_internal_rating_notes.read:all"]);
    expect(hotelAudienceOf(creative)).toEqual({ notes: true, contacts: false });
  });
});

describe("requireNotesWrite", () => {
  it("lets the Hotel team and the Super Admin set the notes", () => {
    expect(() => requireNotesWrite(staffPrincipal(["HT"]), true)).not.toThrow();
    expect(() => requireNotesWrite(staffPrincipal(["SA"]), true)).not.toThrow();
  });

  it("refuses a reader of the notes who may not change them, with a 403", () => {
    expect(() => requireNotesWrite(staffPrincipal(["SM"]), true)).toThrow(
      expect.objectContaining({ code: "forbidden" }),
    );
  });

  it("refuses a custom profile editor without the notes key, unless the write leaves them alone", () => {
    const editor = staffPrincipal([], ["hotels.hotel_profiles_client_fields.update:all"]);
    expect(() => requireNotesWrite(editor, true)).toThrow(
      expect.objectContaining({ code: "forbidden" }),
    );
    expect(() => requireNotesWrite(editor, false)).not.toThrow();
  });
});

describe("importGrantsOf (D-181)", () => {
  const ALL = {
    canUpdate: true,
    canWriteNotes: true,
    canCreateDestinations: true,
    canAddMedia: true,
    readsProfiles: true,
    readsNotes: true,
  };

  it("gives the Hotel team and the Super Admin every key the import's rows ask", () => {
    for (const role of ["HT", "SA"] as const) {
      expect(importGrantsOf(staffPrincipal([role]))).toEqual(ALL);
    }
  });

  it("gives a custom role with only the create key none of them, and reads only what it holds", () => {
    const createOnly = staffPrincipal([], ["hotels.hotel_profiles_client_fields.create:all"]);
    expect(importGrantsOf(createOnly)).toEqual({
      canUpdate: false,
      canWriteNotes: false,
      canCreateDestinations: false,
      canAddMedia: false,
      readsProfiles: false,
      readsNotes: false,
    });
    const reader = staffPrincipal(
      [],
      [
        "hotels.hotel_profiles_client_fields.create:all",
        "hotels.hotel_profiles_client_fields.read:all",
      ],
    );
    expect(importGrantsOf(reader)).toMatchObject({ canUpdate: false, readsProfiles: true });
  });

  it("decides each key on its own: a notes writer need not read the notes", () => {
    const writer = staffPrincipal([], ["hotels.hotel_internal_rating_notes.update:all"]);
    expect(importGrantsOf(writer)).toMatchObject({ canWriteNotes: true, readsNotes: false });
  });
});

describe("requireContactsRead", () => {
  it("answers a principal who cannot read the contacts as if the contact were missing", () => {
    const writer = staffPrincipal([], ["hotels.hotel_contacts.update:all"]);
    expect(() => requireContactsRead(writer)).toThrow(
      expect.objectContaining({ code: "not_found" }),
    );
    expect(() => requireContactsRead(staffPrincipal(["HT"]))).not.toThrow();
  });
});
