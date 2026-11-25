import { errors, HOTEL_FORM_ERRORS } from "@ampm/core";
import { describe, expect, it, vi } from "vitest";

import type { AuditService } from "../../../policy/audit.service.js";
import type { HotelInfoRequestJournal } from "../hotel-info-request-journal.js";
import {
  FORM_LATER,
  FORM_NOW,
  FORM_PERSON_ID,
  FORM_REQUEST_ID,
  FORM_TX,
  formRequests,
  linkedRequest,
  refusalOf,
} from "../testing/hotel-form-fixtures.js";
import type { HotelFormLimits } from "./hotel-form-limits.js";
import { HotelFormMe } from "./hotel-form-me.service.js";
import type { HotelFormPeopleRepository } from "./hotel-form-people.repository.js";
import type { FormSession } from "./hotel-form-sessions.service.js";

/*
 * A signed-in person's own details (D-189 §4 and §5): GET me answers the person and the request; PATCH me
 * changes their name or designation inside the session's write window (10 a minute), never a mobile, as a
 * person_updated event and a guest_token audit naming the fields, not their values; nothing changes once
 * the request shows its status only.
 */

const { tokenHash: _stored, ...REQUEST } = linkedRequest();
const SESSION: FormSession = {
  challengeId: "0192f1a0-0000-7000-8000-0000000000c1",
  requestId: FORM_REQUEST_ID,
  personId: FORM_PERSON_ID,
  person: { fullName: "Stored Person", designation: "General Manager" },
  request: REQUEST,
  state: "ready",
};

function build() {
  const { typed } = formRequests();
  const updateDetails = vi.fn(
    async (_id: string, details: { fullName?: string; designation?: string }) => ({
      id: FORM_PERSON_ID,
      fullName: details.fullName ?? "Stored Person",
      designation: details.designation ?? "General Manager",
    }),
  );
  const allowWrite = vi.fn(async () => undefined);
  const journal = { event: vi.fn(async () => undefined) };
  const audit = { record: vi.fn(async () => undefined) };
  const me = new HotelFormMe(
    typed,
    { updateDetails } as unknown as HotelFormPeopleRepository,
    { allowWrite } as unknown as HotelFormLimits,
    journal as unknown as HotelInfoRequestJournal,
    audit as unknown as AuditService,
  );
  return { me, updateDetails, allowWrite, journal, audit };
}

describe("HotelFormMe", () => {
  it("answers the person and the request as the person sees it", () => {
    expect(build().me.get(SESSION)).toEqual({
      person: { fullName: "Stored Person", designation: "General Manager" },
      request: {
        displayLabel: "Monsoon refresh",
        staffNote: "Rooms first, please",
        status: "open",
        expiresAt: FORM_LATER.toISOString(),
      },
    });
  });

  it("changes the person's own name inside the session's write window", async () => {
    const built = build();
    const answer = await built.me.update(SESSION, { fullName: "Renamed Person" }, FORM_NOW);
    expect(built.allowWrite).toHaveBeenCalledWith("me", SESSION.challengeId);
    expect(built.updateDetails).toHaveBeenCalledWith(
      FORM_PERSON_ID,
      { fullName: "Renamed Person" },
      FORM_TX,
    );
    expect(answer.person).toEqual({ fullName: "Renamed Person", designation: "General Manager" });
  });

  it("records the change by its fields only, as the person", async () => {
    const built = build();
    await built.me.update(SESSION, { fullName: "Renamed", designation: "Sales Manager" }, FORM_NOW);
    expect(built.journal.event).toHaveBeenCalledWith(
      {
        requestId: FORM_REQUEST_ID,
        eventType: "person_updated",
        actor: { kind: "hotel_person", personId: FORM_PERSON_ID },
        at: FORM_NOW,
        detail: { fields: ["fullName", "designation"] },
      },
      FORM_TX,
    );
    expect(built.audit.record).toHaveBeenCalledWith(
      {
        action: "update",
        entityType: "hotel_info_request_person",
        entityId: FORM_PERSON_ID,
        after: {
          id: FORM_PERSON_ID,
          requestId: FORM_REQUEST_ID,
          changedFields: ["fullName", "designation"],
        },
      },
      FORM_TX,
    );
  });

  it("writes nothing when nothing changed", async () => {
    const built = build();
    const answer = await built.me.update(SESSION, { designation: "General Manager" }, FORM_NOW);
    expect(built.updateDetails).not.toHaveBeenCalled();
    expect(built.journal.event).not.toHaveBeenCalled();
    expect(answer.person).toEqual(SESSION.person);
  });

  it("refuses past the write window, writing nothing", async () => {
    const built = build();
    built.allowWrite.mockRejectedValueOnce(errors.rateLimited(HOTEL_FORM_ERRORS.writeLimit, 30));
    const refused = await refusalOf(built.me.update(SESSION, { fullName: "Again" }, FORM_NOW));
    expect(refused?.status).toBe(429);
    expect(built.updateDetails).not.toHaveBeenCalled();
  });

  it("changes nothing once the request shows its status only", async () => {
    const built = build();
    const merged: FormSession = { ...SESSION, state: "status_only" };
    const refused = await refusalOf(built.me.update(merged, { fullName: "Late" }, FORM_NOW));
    expect(refused?.status).toBe(409);
    expect(refused?.message).toBe(HOTEL_FORM_ERRORS.readOnly);
    expect(built.allowWrite).not.toHaveBeenCalled();
  });

  it("lets a person fix their details while the request is locked for review", async () => {
    const built = build();
    const locked: FormSession = { ...SESSION, state: "locked" };
    const answer = await built.me.update(locked, { fullName: "Fixed Name" }, FORM_NOW);
    expect(answer.person.fullName).toBe("Fixed Name");
  });
});
