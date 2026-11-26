import {
  HOTEL_FORM_ACCURACY_VERSION,
  HOTEL_FORM_DISPLAY_VERSION,
  HOTEL_FORM_ERRORS,
  hotelFormMissingItemsOf,
  hotelFormSectionsChangedOf,
  hotelFormSessionRefusalOf,
} from "@ampm/core";
import { describe, expect, it } from "vitest";

import { FORM_IP, refusalOf } from "../testing/hotel-form-fixtures.js";
import {
  FORM_NOW,
  FORM_PERSON_ID,
  FORM_REFERENCE,
  FORM_REQUEST_ID,
  FORM_REVISION_ID,
  FORM_TX,
  formSession,
  formSubmission,
  sectionRow,
} from "../testing/hotel-form-draft-fixtures.js";
import {
  BODY,
  bodyFor,
  buildSubmission as build,
  COMPLETE,
  expectNothingWritten,
  revisionHashOf,
} from "../testing/hotel-form-submission-fakes.js";

/*
 * Submitting the form (D-190 §3) with fakes: under the request's lock, the declarations' versions, the bot
 * check for `hf_submit`, the section versions the review page read (409 sectionsChanged), the strict check,
 * revision n+1 with every section and its hash, both declarations
 * bound to that hash, the System's move with a conditional write, the `submitted` event, an allow-listed
 * audit, then the staff notice. A repeat is in hotel-form-submission.repeat.spec.ts; the database side in
 * test/hotel-form-submit.e2e-spec.ts.
 */

describe("HotelFormSubmission: a submit", () => {
  it("writes revision 1, binds both declarations to its hash, moves the request and tells staff", async () => {
    const built = build();
    const answer = await built.service.submit(formSession(), BODY, FORM_IP, FORM_NOW);
    expect(answer).toEqual({
      reference: FORM_REFERENCE,
      status: "submitted",
      submittedAt: FORM_NOW.toISOString(),
    });
    const hash = revisionHashOf(COMPLETE);
    expect(built.sub.createRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: FORM_REQUEST_ID,
        revision: 1,
        answersHash: hash,
        submittedByPersonId: FORM_PERSON_ID,
        submittedAt: FORM_NOW,
      }),
      FORM_TX,
    );
    const [revision] = built.sub.createRevision.mock.calls[0] ?? [];
    expect(Object.keys(revision?.answers ?? {}).sort()).toEqual([
      "booking_terms",
      "contact",
      "fact_sheet_media",
      "food_beverage",
      "property",
      "rooms",
      "venues",
    ]);
    expect(built.addDeclarations).toHaveBeenCalledWith(
      {
        personId: FORM_PERSON_ID,
        revisionHash: hash,
        accuracyVersion: HOTEL_FORM_ACCURACY_VERSION,
        displayVersion: HOTEL_FORM_DISPLAY_VERSION,
        display: "yes",
        ipAddress: FORM_IP,
        at: FORM_NOW,
      },
      FORM_TX,
    );
    expect(built.updateIf).toHaveBeenCalledWith(
      FORM_REQUEST_ID,
      { statuses: ["open"] },
      {
        status: "submitted",
        revision: 1,
        submittedAt: FORM_NOW,
        submittedByPersonId: FORM_PERSON_ID,
      },
      FORM_TX,
    );
    expect(built.journal.event).toHaveBeenCalledWith(
      {
        requestId: FORM_REQUEST_ID,
        eventType: "submitted",
        actor: { kind: "hotel_person", personId: FORM_PERSON_ID },
        at: FORM_NOW,
        detail: { revision: 1 },
      },
      FORM_TX,
    );
    expect(built.journal.record).toHaveBeenCalledWith(
      FORM_REQUEST_ID,
      {
        action: "update",
        after: {
          id: FORM_REQUEST_ID,
          revisionId: FORM_REVISION_ID,
          personId: FORM_PERSON_ID,
          consentIds: ["consent-a", "consent-b"],
          revision: 1,
          answersHash: hash,
          kinds: ["accuracy_attestation", "display_authorisation"],
          changedFields: ["status", "revision", "submittedAt", "submittedByPersonId"],
        },
      },
      FORM_TX,
    );
    expect(built.submitted).toHaveBeenCalledWith(FORM_REQUEST_ID);
    expect(built.verify).toHaveBeenCalledWith("turnstile-pass", {
      remoteIp: FORM_IP,
      expectedHostnames: ["site.synthetic.example"],
      expectedAction: "hf_submit",
    });
  });

  it("submits a request awaiting changes as the next revision, recording 7.5's No", async () => {
    const built = build({ locked: formSubmission({ status: "changes_requested", revision: 1 }) });
    const no = {
      ...BODY,
      display: { answer: "no" as const, textVersion: HOTEL_FORM_DISPLAY_VERSION },
    };
    await built.service.submit(formSession(), no, FORM_IP, FORM_NOW);
    expect(built.sub.createRevision).toHaveBeenCalledWith(
      expect.objectContaining({ revision: 2 }),
      FORM_TX,
    );
    expect(built.addDeclarations).toHaveBeenCalledWith(
      expect.objectContaining({ display: "no" }),
      FORM_TX,
    );
    expect(built.updateIf).toHaveBeenCalledWith(
      FORM_REQUEST_ID,
      { statuses: ["changes_requested"] },
      expect.objectContaining({ revision: 2 }),
      FORM_TX,
    );
  });

  it("asks nothing of a refresh's empty sections: blanks leave the records as they are", async () => {
    const built = build({ locked: formSubmission({ kind: "refresh" }), rows: [] });
    const answer = await built.service.submit(formSession(), bodyFor([]), FORM_IP, FORM_NOW);
    expect(answer.status).toBe("submitted");
  });
});

describe("HotelFormSubmission: what a submit is refused for", () => {
  it("refuses declarations in older words with 409 noticeStale, writing nothing", async () => {
    const built = build();
    const stale = {
      ...BODY,
      accuracy: { accepted: true as const, textVersion: "hf-accuracy-2020-01-01" },
    };
    const refused = await refusalOf(built.service.submit(formSession(), stale, FORM_IP, FORM_NOW));
    expect(refused?.status).toBe(409);
    expect(refused?.message).toBe(HOTEL_FORM_ERRORS.noticeStale);
    expectNothingWritten(built);
  });

  it("refuses a failed bot check with 400 on botToken, writing nothing", async () => {
    const built = build({ human: false });
    const refused = await refusalOf(built.service.submit(formSession(), BODY, FORM_IP, FORM_NOW));
    expect(refused?.status).toBe(400);
    expect(refused?.details).toEqual([{ path: "botToken", message: HOTEL_FORM_ERRORS.botCheck }]);
    expectNothingWritten(built);
  });

  it("refuses an incomplete form with 400 submitIncomplete, listing every missing item", async () => {
    const rows = [sectionRow("contact", { contacts: [{ role: "Sales" }] })];
    const built = build({ rows });
    const refused = await refusalOf(
      built.service.submit(formSession(), bodyFor(rows), FORM_IP, FORM_NOW),
    );
    expect(refused?.status).toBe(400);
    expect(refused?.message).toBe(HOTEL_FORM_ERRORS.submitIncomplete);
    expect(refused && hotelFormMissingItemsOf(refused)).toEqual([
      { section: "property", field: "name", message: "Enter the hotel's name" },
      { section: "property", field: "city", message: "Enter the city" },
      { section: "property", field: "state", message: "Choose the state" },
      {
        section: "contact",
        field: "contacts",
        message: "Add a contact with an email or a phone number",
      },
      { section: "contact", field: "contacts.0.name", message: "Name this contact" },
    ]);
    expectNothingWritten(built);
  });

  it("refuses with 409 sectionsChanged, naming each section saved since the review page read it", async () => {
    const seen = [sectionRow("property", { name: "Synthetic Lake Palace" })];
    const now = [
      sectionRow("property", { name: "Synthetic Lake Palace", city: "Udaipur" }, { version: 2 }),
      ...COMPLETE.slice(1),
    ];
    const built = build({ rows: now });
    const refused = await refusalOf(
      built.service.submit(formSession(), bodyFor(seen), FORM_IP, FORM_NOW),
    );
    expect(refused?.status).toBe(409);
    expect(refused?.message).toBe(HOTEL_FORM_ERRORS.sectionsChanged);
    expect(refused && hotelFormSectionsChangedOf(refused)).toEqual(["property", "contact"]);
    expectNothingWritten(built);
  });

  it("checks the versions before the strict check, so an incomplete form a colleague changed says so", async () => {
    const built = build({ rows: [sectionRow("contact", { contacts: [{ role: "Sales" }] })] });
    const refused = await refusalOf(
      built.service.submit(formSession(), bodyFor([]), FORM_IP, FORM_NOW),
    );
    expect(refused?.message).toBe(HOTEL_FORM_ERRORS.sectionsChanged);
    expect(refused && hotelFormSectionsChangedOf(refused)).toEqual(["contact"]);
  });

  it("answers 401 not_active for a request that left the form since the guard passed", async () => {
    const refused = await refusalOf(
      build({ locked: formSubmission({ status: "revoked" }) }).service.submit(
        formSession(),
        BODY,
        FORM_IP,
        FORM_NOW,
      ),
    );
    expect(refused && hotelFormSessionRefusalOf(refused)).toBe("not_active");
  });

  it("writes nothing that lands when the System's move finds the request moved", async () => {
    const built = build({ written: 0 });
    const refused = await refusalOf(built.service.submit(formSession(), BODY, FORM_IP, FORM_NOW));
    expect(refused?.status).toBe(409);
    expect(built.journal.event).not.toHaveBeenCalled();
    expect(built.submitted).not.toHaveBeenCalled();
  });
});
