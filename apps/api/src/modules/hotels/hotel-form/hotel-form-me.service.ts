import { Injectable } from "@nestjs/common";
import {
  errors,
  HOTEL_FORM_ERRORS,
  type HotelFormMe as HotelFormMeView,
  type HotelFormMeUpdateRequest,
  type HotelFormPerson,
} from "@ampm/core";

import { AuditService } from "../../../policy/audit.service.js";
import { HotelInfoRequestJournal } from "../hotel-info-request-journal.js";
import { HOTEL_FORM_PERSON_ENTITY } from "./hotel-form-enrolment.service.js";
import { HotelFormLimits } from "./hotel-form-limits.js";
import { HotelFormPeopleRepository } from "./hotel-form-people.repository.js";
import { HotelFormRequestsRepository } from "./hotel-form-requests.repository.js";
import type { FormSession } from "./hotel-form-sessions.service.js";
import { requestViewOf } from "./hotel-form-state.js";

/** The fields a person may change of their own: never their mobile, which needs a new code. */
type OwnField = keyof HotelFormPerson;
const OWN_FIELDS: readonly OwnField[] = ["fullName", "designation"];

/**
 * A signed-in person's own details (D-189 §4 and §5). `get` answers the person, their id on the request
 * (for the page to tell whether a new code signed the same person in again), the request as they see it,
 * and their own current answer to 7.5 (`photoPermission`, read again on every answer, so a withdrawal or
 * a new submit shows at once). `update` changes their name or designation inside the session's write
 * window (10 a minute), as a `person_updated` event and a guest_token audit that name the fields changed,
 * never their values; it changes nothing once the request shows its status only (after the merge, plan
 * §4.2), and writes nothing when nothing differs.
 */
@Injectable()
export class HotelFormMe {
  constructor(
    private readonly requests: HotelFormRequestsRepository,
    private readonly people: HotelFormPeopleRepository,
    private readonly limits: HotelFormLimits,
    private readonly journal: HotelInfoRequestJournal,
    private readonly audit: AuditService,
  ) {}

  get(session: FormSession): Promise<HotelFormMeView> {
    return this.answer(session, session.person);
  }

  async update(
    session: FormSession,
    body: HotelFormMeUpdateRequest,
    now: Date = new Date(),
  ): Promise<HotelFormMeView> {
    if (session.state === "status_only") throw errors.conflict(HOTEL_FORM_ERRORS.readOnly);
    await this.limits.allowWrite("me", session.challengeId);
    const changes: Partial<HotelFormPerson> = {};
    for (const field of OWN_FIELDS) {
      const value = body[field];
      if (value !== undefined && value !== session.person[field]) changes[field] = value;
    }
    const changedFields = OWN_FIELDS.filter((field) => changes[field] !== undefined);
    if (changedFields.length === 0) return this.get(session);
    const person = await this.requests.transaction(async (tx) => {
      const updated = await this.people.updateDetails(session.personId, changes, tx);
      await this.journal.event(
        {
          requestId: session.requestId,
          eventType: "person_updated",
          actor: { kind: "hotel_person", personId: session.personId },
          at: now,
          detail: { fields: changedFields },
        },
        tx,
      );
      await this.audit.record(
        {
          action: "update",
          entityType: HOTEL_FORM_PERSON_ENTITY,
          entityId: session.personId,
          after: { id: session.personId, requestId: session.requestId, changedFields },
        },
        tx,
      );
      return updated;
    });
    return this.answer(session, { fullName: person.fullName, designation: person.designation });
  }

  /** The answer for the session's person, with `person` as stored now. */
  private async answer(session: FormSession, person: HotelFormPerson): Promise<HotelFormMeView> {
    return {
      personId: session.personId,
      person,
      request: requestViewOf(session.request),
      photoPermission: await this.people.photoPermissionOf(session.personId),
    };
  }
}
