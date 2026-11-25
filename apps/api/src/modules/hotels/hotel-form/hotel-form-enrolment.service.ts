import { Injectable } from "@nestjs/common";
import {
  errors,
  HOTEL_FORM_ERRORS,
  type HotelFormCodeDelivery,
  type HotelFormLinkState,
  type HotelFormPolicy,
  type HotelFormVerified,
} from "@ampm/core";

import { requestContext } from "../../../common/request-context.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { AuditService } from "../../../policy/audit.service.js";
import { HotelInfoRequestJournal } from "../hotel-info-request-journal.js";
import {
  HotelFormChallengesRepository,
  type ChallengeClaim,
} from "./hotel-form-challenges.repository.js";
import { invalidCode } from "./hotel-form-refusal.js";
import { HotelFormPeopleRepository, type PersonRow } from "./hotel-form-people.repository.js";
import { HotelFormRequestsRepository } from "./hotel-form-requests.repository.js";
import { mintSessionToken, sessionsToEnd } from "./hotel-form-session-rules.js";
import { HotelFormSessionsRepository } from "./hotel-form-sessions.repository.js";
import { linkStateOf, requestViewOf, type FormRequest } from "./hotel-form-state.js";

/** The audit's entity for a person of a request. */
export const HOTEL_FORM_PERSON_ENTITY = "hotel_info_request_person";

/** A right code, ready to enrol: its request, the policy as read, its challenge and the caller's address. */
export interface EnrolInput {
  readonly requestId: string;
  readonly policy: HotelFormPolicy;
  readonly challenge: {
    readonly id: string;
    readonly linkGeneration: number;
    readonly delivery: HotelFormCodeDelivery;
  };
  readonly ip: string | null;
}

/** The person a right code is for, and whether they were already the request's. */
interface Enrolled {
  readonly person: PersonRow;
  readonly returning: boolean;
}

/** The request, locked and still open to the form on the challenge's link. */
interface OpenRequest {
  readonly request: FormRequest;
  readonly state: Exclude<HotelFormLinkState, "not_active">;
}

/**
 * What a right hotel form code does (D-189 §4 and §5), in one transaction that first locks the request's
 * row, so the people of one request are counted and created one verify at a time and a staff revoke or
 * reissue in flight is waited for and seen. The person is found by request and phone (a returning person
 * keeps their stored name and designation: a claim never renames anyone) or created from the claim (not
 * past `maxPeople`, not after the merge, not on a mobile AMPM removed); the privacy notice's consent is
 * recorded; the challenge is spent on the person and its claim cleared; a session opens, ending the
 * person's oldest beyond three; and the event and the audit are the person's.
 */
@Injectable()
export class HotelFormEnrolment {
  constructor(
    private readonly requests: HotelFormRequestsRepository,
    private readonly challenges: HotelFormChallengesRepository,
    private readonly people: HotelFormPeopleRepository,
    private readonly sessions: HotelFormSessionsRepository,
    private readonly journal: HotelInfoRequestJournal,
    private readonly audit: AuditService,
  ) {}

  enrol(input: EnrolInput, now: Date): Promise<HotelFormVerified> {
    return this.requests.transaction(async (tx) => {
      const { request, state } = await this.lockOpenRequest(input, now, tx);
      const claim = await this.challenges.lockClaim(input.challenge.id, tx);
      if (claim === null) throw invalidCode();
      const enrolled = await this.personFor(request, state, claim, input, now, tx);
      const { person } = enrolled;
      const session = mintSessionToken();
      const use = { personId: person.id, sessionTokenHash: session.hash, at: now };
      if (!(await this.challenges.markUsed(input.challenge.id, use, tx))) throw invalidCode();
      const consent = {
        personId: person.id,
        textVersion: claim.noticeVersion,
        ipAddress: input.ip,
        at: now,
      };
      await this.people.addNoticeConsent(consent, tx);
      const open = await this.sessions.openSessionsOf(person.id, tx);
      await this.sessions.endSessions(sessionsToEnd(open, now), now, tx);
      await this.record(request, enrolled, input, now, tx);
      return {
        sessionToken: session.token,
        person: { fullName: person.fullName, designation: person.designation },
        request: requestViewOf(request),
      };
    });
  }

  /** The request locked for the transaction; 404 once it is not open to the form on the challenge's link. */
  private async lockOpenRequest(
    input: EnrolInput,
    now: Date,
    tx: Prisma.TransactionClient,
  ): Promise<OpenRequest> {
    const request = await this.requests.lockForForm(input.requestId, tx);
    const state = linkStateOf(request, input.policy.mode, now);
    if (
      request === null ||
      state === "not_active" ||
      request.tokenGeneration !== input.challenge.linkGeneration
    ) {
      throw errors.notFound(HOTEL_FORM_ERRORS.notActive);
    }
    return { request, state };
  }

  private async personFor(
    request: FormRequest,
    state: OpenRequest["state"],
    claim: ChallengeClaim,
    input: EnrolInput,
    now: Date,
    tx: Prisma.TransactionClient,
  ): Promise<Enrolled> {
    const entered = { at: now, delivery: input.challenge.delivery };
    const live = await this.people.findLive(request.id, claim.phone, tx);
    if (live !== null) {
      await this.people.markReturning(live.id, entered, tx);
      return { person: live, returning: true };
    }
    if (await this.people.wasRemoved(request.id, claim.phone, tx)) {
      throw errors.forbidden(HOTEL_FORM_ERRORS.mobileRemoved);
    }
    if (state === "status_only") throw errors.conflict(HOTEL_FORM_ERRORS.closedToNewPeople);
    if ((await this.people.countLive(request.id, tx)) >= input.policy.maxPeople) {
      throw errors.conflict(HOTEL_FORM_ERRORS.peopleFull);
    }
    const { fullName, designation, phone } = claim;
    const person = await this.people.create(
      { requestId: request.id, fullName, designation, phone, ...entered },
      tx,
    );
    return { person, returning: false };
  }

  /** The person's event and audit: from here on, the request's actor is the person (D-189 §6). */
  private async record(
    request: FormRequest,
    { person, returning }: Enrolled,
    input: EnrolInput,
    now: Date,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const { id: challengeId, delivery } = input.challenge;
    requestContext.setHotelFormActor({ requestId: request.id, personId: person.id });
    await this.journal.event(
      {
        requestId: request.id,
        eventType: "person_verified",
        actor: { kind: "hotel_person", personId: person.id },
        at: now,
        detail: { challengeId, delivery, returning },
      },
      tx,
    );
    const changedFields = returning
      ? ["codeEnteredAt", "codeDelivery"]
      : ["fullName", "designation", "phone"];
    await this.audit.record(
      {
        action: returning ? "update" : "create",
        entityType: HOTEL_FORM_PERSON_ENTITY,
        entityId: person.id,
        after: { id: person.id, requestId: request.id, challengeId, changedFields },
      },
      tx,
    );
  }
}
