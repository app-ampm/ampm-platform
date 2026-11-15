import { buildContactCreate, buildContactUpdate, contactDraftOf } from "./account-contact.form";
import { buildDetailsUpdate, detailsDraftOf, validateDetails } from "./account-details.form";
import { accountContactViewFixture, accountDetailViewFixture } from "./accounts.test-utils";
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
    const draft = { ...detailsDraftOf(account), coupleNames: "Priya & Rohan", internalNotes: "" };
    expect(buildDetailsUpdate(draft, account)).toEqual({
      coupleNames: "Priya & Rohan",
      internalNotes: null,
    });
    expect(buildDetailsUpdate(detailsDraftOf(account), account)).toBeNull();
  });
});

describe("accountPermissionsFor", () => {
  it("lets Sales keep the account and its contacts and open its enquiries, agreements and lead", () => {
    expect(accountPermissionsFor(["SM"])).toEqual({
      canEdit: true,
      canAddContact: true,
      canRemoveContact: true,
      canReadEnquiries: true,
      canReadAgreements: true,
      canReadLeads: true,
    });
  });

  it("leaves the hotel team reading: enquiries yes, edits no", () => {
    const permissions = accountPermissionsFor(["HT"]);
    expect(permissions.canReadEnquiries).toBe(true);
    expect(permissions.canEdit).toBe(false);
    expect(permissions.canAddContact).toBe(false);
    expect(permissions.canRemoveContact).toBe(false);
  });

  it("gives a Project Manager's assigned-only grant no edit on an account route", () => {
    expect(accountPermissionsFor(["PM"]).canEdit).toBe(false);
  });
});
