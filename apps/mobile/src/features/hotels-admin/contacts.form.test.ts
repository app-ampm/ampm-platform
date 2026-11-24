import { HOTEL_PHONE_REFUSAL } from "@ampm/core";

import {
  buildContactBody,
  contactUpdateBody,
  draftFromContact,
  phoneHint,
  phonePreview,
  validateContact,
  type ContactDraft,
} from "./contacts.form";
import { hotelContactViewFixture } from "./hotels-admin.test-utils";

const blank = draftFromContact(null);
// Escaped, never the character itself: text pasted from a PDF can carry this invisible one.
const NUL = "\u0000";

describe("contacts.form", () => {
  it("starts a new contact blank and not primary, and seeds an edit from the contact", () => {
    expect(blank).toEqual({ name: "", roleTitle: "", phone: "", email: "", isPrimary: false });
    expect(draftFromContact(hotelContactViewFixture())).toEqual({
      name: "Priya Sharma",
      roleTitle: "Events Manager",
      phone: "+911234567801",
      email: "priya@lakeside.example",
      isPrimary: true,
    });
  });

  it("previews a typed phone in E.164, the form a save keeps it in", () => {
    const draft: ContactDraft = { ...blank, phone: "0141-234 5678" };
    expect(phonePreview(draft, null)).toEqual({ kind: "saved", phone: "+911412345678" });
    expect(phoneHint(phonePreview(draft, null))).toBe("Saved as +911412345678");
    expect(phoneHint(phonePreview(blank, null))).toBe(
      "Ten digits for an Indian number, or + and the country code",
    );
  });

  it("refuses a phone that is not one full number, inline and on save", () => {
    const draft: ContactDraft = { ...blank, name: "Asha", phone: "+91 141 234 5678 ext 12" };
    expect(phonePreview(draft, null)).toEqual({ kind: "refused" });
    expect(phoneHint(phonePreview(draft, null))).toBe(HOTEL_PHONE_REFUSAL);
    expect(validateContact(draft, null).phone).toBe(HOTEL_PHONE_REFUSAL);
  });

  it("keeps a phone saved before E.164 as it is while it is not changed, so it never blocks an edit", () => {
    const contact = hotelContactViewFixture({ phone: "12345 678 ext 9" });
    const draft = { ...draftFromContact(contact), roleTitle: "General Manager" };
    expect(phonePreview(draft, contact)).toEqual({ kind: "saved", phone: "12345 678 ext 9" });
    expect(validateContact(draft, contact).phone).toBeUndefined();
    expect(contactUpdateBody(draft, contact)).toEqual({ roleTitle: "General Manager" });
  });

  it("sends the phone in E.164, and on an update only when its text changed", () => {
    const create = buildContactBody({ ...blank, name: "Asha Rao", phone: "1800 123 4567" });
    expect(create).toEqual({
      name: "Asha Rao",
      roleTitle: null,
      phone: "+9118001234567",
      email: null,
      isPrimary: false,
    });
    const contact = hotelContactViewFixture();
    const retyped = { ...draftFromContact(contact), phone: "01234 567 802" };
    expect(contactUpdateBody(retyped, contact)).toEqual({ phone: "+911234567802" });
    expect(contactUpdateBody({ ...retyped, phone: " " }, contact)).toEqual({ phone: null });
  });

  // The contract refuses the null character, which no one can see to remove, so the sheet drops it.
  it("checks and sends its text without the null character, a name of only that being none", () => {
    const draft: ContactDraft = {
      name: `Asha${NUL} Rao`,
      roleTitle: `Sales${NUL}`,
      phone: `0141-234 5678${NUL}`,
      email: `asha${NUL}@hotel.example`,
      isPrimary: false,
    };
    expect(phonePreview(draft, null)).toEqual({ kind: "saved", phone: "+911412345678" });
    expect(validateContact(draft, null)).toEqual({
      name: undefined,
      phone: undefined,
      email: undefined,
    });
    expect(buildContactBody(draft)).toEqual({
      name: "Asha Rao",
      roleTitle: "Sales",
      phone: "+911412345678",
      email: "asha@hotel.example",
      isPrimary: false,
    });
    expect(validateContact({ ...blank, name: NUL }, null).name).toBe("Give the contact a name");
    const contact = hotelContactViewFixture();
    const repeated = { ...draftFromContact(contact), phone: `${contact.phone ?? ""}${NUL}` };
    expect(contactUpdateBody(repeated, contact)).toEqual({});
  });

  it("updates only what changed: making a contact primary sends that alone", () => {
    const contact = hotelContactViewFixture({ isPrimary: false });
    const draft = { ...draftFromContact(contact), isPrimary: true };
    expect(contactUpdateBody(draft, contact)).toEqual({ isPrimary: true });
    expect(contactUpdateBody(draftFromContact(contact), contact)).toEqual({});
  });

  // The sheet checks the email by the contract's own rule, so an address the API would refuse with a bare
  // "Validation failed" is named on its field before the save.
  it.each(["desk@hotel.c", "desk@hotel..example", "desk.@hotel.example"])(
    "refuses %s, which the contract refuses too",
    (email) => {
      expect(validateContact({ ...blank, name: "Synthetic Desk", email }, null).email).toBe(
        "Enter a valid email address",
      );
    },
  );

  it("names a missing name and a malformed email, and lower-cases the email", () => {
    const errors = validateContact({ ...blank, email: "nope" }, null);
    expect(errors).toEqual({
      name: "Give the contact a name",
      phone: undefined,
      email: "Enter a valid email address",
    });
    expect(buildContactBody({ ...blank, name: "Asha", email: " Asha@Hotel.Example " }).email).toBe(
      "asha@hotel.example",
    );
  });
});
