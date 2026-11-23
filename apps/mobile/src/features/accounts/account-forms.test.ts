import { staffAccessFor } from "@ampm/api-client";

import { buildContactCreate, buildContactUpdate, contactDraftOf } from "./account-contact.form";
import {
  buildDetailsUpdate,
  detailsDraftOf,
  draftCoupleTitle,
  validateDetails,
} from "./account-details.form";
import {
  accountContactViewFixture,
  accountDetailViewFixture,
  staffMeFixture,
} from "./accounts.test-utils";
import { accountPermissionsFor } from "./use-account-permissions";

const USER_ID = "018f0000-0000-7000-8000-0000000d00aa";

describe("buildContactCreate", () => {
  const draft = { ...contactDraftOf(), name: "Anil Sharma", relation: "Father of the bride" };

  it("builds the add body, leaving blank optional fields out and normalising the phone", () => {
    const built = buildContactCreate({ ...draft, phone: "98765 00001" });
    expect(built).toEqual({
      ok: true,
      body: {
        name: "Anil Sharma",
        relation: "Father of the bride",
        phone: "+919876500001",
        isDecisionMaker: false,
        invite: false,
      },
    });
  });

  it("names the missing fields in the form's words", () => {
    const built = buildContactCreate(contactDraftOf());
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.errors.name).toBe("Enter their name");
    expect(built.errors.relation).toMatch(/Say who they are/);
  });

  it("asks for an email before a portal invite (AUTH-02)", () => {
    const built = buildContactCreate({ ...draft, invite: true });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.errors.email).toBe("Give an email to send the portal invite to");
  });
});

describe("buildContactUpdate", () => {
  it("sends nothing when nothing changed", () => {
    const contact = accountContactViewFixture({ phone: "+919876543210" });
    expect(buildContactUpdate(contactDraftOf(contact), contact)).toEqual({ ok: true, body: null });
  });

  it("sends only the changed fields, and clears an emptied one with null", () => {
    const contact = accountContactViewFixture({ phone: "+919876543210" });
    const draft = {
      ...contactDraftOf(contact),
      relation: "Bride",
      phone: "",
      isDecisionMaker: false,
    };
    expect(buildContactUpdate(draft, contact)).toEqual({
      ok: true,
      body: { phone: null, isDecisionMaker: false },
    });
  });

  it("never sends the email of a contact who signs in with it", () => {
    const contact = accountContactViewFixture({ userId: USER_ID, phone: "+919876543210" });
    const draft = { ...contactDraftOf(contact), email: "someone-else@example.com" };
    expect(buildContactUpdate(draft, contact)).toEqual({ ok: true, body: null });
  });
});

describe("account details form", () => {
  const account = accountDetailViewFixture({ internalNotes: "Prefers calls" });

  it("refuses an emptied name", () => {
    expect(validateDetails({ ...detailsDraftOf(account), name: "  " }).name).toBe(
      "Enter the client's name",
    );
  });

  it("sends only the changed fields, an emptied optional one as null", () => {
    const draft = {
      ...detailsDraftOf(account),
      brideFatherName: "Rahul Sharma",
      internalNotes: "",
    };
    expect(buildDetailsUpdate(draft, account)).toEqual({
      brideFatherName: "Rahul Sharma",
      internalNotes: null,
    });
    expect(buildDetailsUpdate(detailsDraftOf(account), account)).toBeNull();
  });

  it("names the client after the couple once both are given, so the name is not sent", () => {
    const draft = { ...detailsDraftOf(account), name: "", brideName: "Priya ", groomName: "Arjun" };
    expect(draftCoupleTitle(draft)).toBe("Priya & Arjun");
    // An emptied name box is fine then: the couple names the client.
    expect(validateDetails(draft).name).toBeUndefined();
    expect(buildDetailsUpdate(draft, account)).toEqual({ brideName: "Priya", groomName: "Arjun" });
  });

  it("keeps the name required while only one of the couple is given", () => {
    const draft = { ...detailsDraftOf(account), name: " ", brideName: "Priya" };
    expect(draftCoupleTitle(draft)).toBeNull();
    expect(validateDetails(draft).name).toBe("Enter the client's name");
  });
});

const access = (roles: Parameters<typeof staffMeFixture>[0], customCapabilities: string[] = []) =>
  staffAccessFor(staffMeFixture(roles, customCapabilities));

describe("accountPermissionsFor", () => {
  it("D-164: lets a custom role with no system role edit the account, as the server allows", () => {
    const permissions = accountPermissionsFor(
      access([], ["crm.accounts.read:all", "crm.accounts.update:all", "crm.leads.read:all"]),
    );
    expect(permissions.canEdit).toBe(true);
    expect(permissions.canReadLeads).toBe(true);
    expect(permissions.canAddContact).toBe(false);
    expect(permissions.canReadEnquiries).toBe(false);
  });

  it("lets Sales keep the account and its contacts and open its saved hotels, enquiries, agreements and lead", () => {
    expect(accountPermissionsFor(access(["SM"]))).toEqual({
      canEdit: true,
      canAddContact: true,
      canRemoveContact: true,
      canReadEnquiries: true,
      canReadSavedHotels: true,
      canReadAgreements: true,
      canReadLeads: true,
    });
  });

  it("leaves the hotel team reading: enquiries and saved hotels yes, edits no", () => {
    const permissions = accountPermissionsFor(access(["HT"]));
    expect(permissions.canReadEnquiries).toBe(true);
    expect(permissions.canReadSavedHotels).toBe(true);
    expect(permissions.canEdit).toBe(false);
    expect(permissions.canAddContact).toBe(false);
    expect(permissions.canRemoveContact).toBe(false);
  });

  it("gives a Project Manager's assigned-only grant no edit on an account route", () => {
    expect(accountPermissionsFor(access(["PM"])).canEdit).toBe(false);
  });

  it("keeps clients' saved hotels from Finance, whose role has no read of them", () => {
    expect(accountPermissionsFor(access(["FA"])).canReadSavedHotels).toBe(false);
  });
});
