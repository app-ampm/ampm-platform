import { Injectable } from "@nestjs/common";
import {
  hotelFormSessionError,
  type Acknowledged,
  type HotelFormLinkState,
  type HotelFormPerson,
} from "@ampm/core";

import { requestContext } from "../../../common/request-context.js";
import { AuditService } from "../../../policy/audit.service.js";
import { HotelFormGate, sameDigest } from "./hotel-form-gate.js";
import { HotelFormRequestsRepository } from "./hotel-form-requests.repository.js";
import { sessionRefusal } from "./hotel-form-session-checks.js";
import { hashSessionToken, needsTouch, sessionTokenFrom } from "./hotel-form-session-rules.js";
import {
  HotelFormSessionsRepository,
  type SessionRecord,
} from "./hotel-form-sessions.repository.js";
import { linkStateOf, type FormRequest } from "./hotel-form-state.js";

/** The audit's entity for a form session (sign-out ends one). */
export const HOTEL_FORM_SESSION_ENTITY = "hotel_form_session";

/** A form session that passed every re-check: who is signed in, on which request, in what state. */
export interface FormSession {
  /** The challenge that carries the session. */
  readonly challengeId: string;
  readonly requestId: string;
  readonly personId: string;
  readonly person: HotelFormPerson;
  readonly request: FormRequest;
  readonly state: Exclude<HotelFormLinkState, "not_active">;
}

/**
 * Hotel form sessions (D-189 §5): what HotelFormSessionGuard runs on every session route, after the global
 * guards. The mode is read fresh (off is 404, as on every public route); the Bearer `hfs_` token is found
 * by its SHA-256 and compared in constant time; then every re-check (sessionRefusal). Any failure is a 401
 * whose reason the page reads to ask for a new code in place. A session that passes is seen (`last_seen`
 * at most once a minute) and its person becomes the request's actor, so its writes audit as guest_token.
 */
@Injectable()
export class HotelFormSessions {
  constructor(
    private readonly gate: HotelFormGate,
    private readonly sessions: HotelFormSessionsRepository,
    private readonly requests: HotelFormRequestsRepository,
    private readonly audit: AuditService,
  ) {}

  /** The session an `Authorization` header carries, re-checked at `now`; a 401 with its reason if not. */
  async authenticate(header: string | undefined, now: Date): Promise<FormSession> {
    const policy = await this.gate.policy();
    const token = sessionTokenFrom(header);
    if (token === null) throw hotelFormSessionError("no_session");
    const hash = hashSessionToken(token);
    const record = await this.sessions.findByTokenHash(hash);
    if (record === null || !sameDigest(record.tokenHash, hash)) {
      throw hotelFormSessionError("no_session");
    }
    const reason = sessionRefusal(record, policy.mode, now);
    if (reason !== null) throw hotelFormSessionError(reason);
    const session = formSessionOf(record, linkStateOf(record.request, policy.mode, now));
    if (needsTouch(record.lastSeenAt ?? record.startedAt, now)) {
      await this.sessions.touch(record.challengeId, record.person.id, now);
    }
    requestContext.setHotelFormActor({ requestId: record.requestId, personId: record.person.id });
    return session;
  }

  /** Ends the session the guard passed, audited as its person. */
  async signOut(session: FormSession, now: Date = new Date()): Promise<Acknowledged> {
    await this.requests.transaction(async (tx) => {
      if (!(await this.sessions.endSession(session.challengeId, now, tx))) return;
      await this.audit.record(
        {
          action: "update",
          entityType: HOTEL_FORM_SESSION_ENTITY,
          entityId: session.challengeId,
          after: {
            id: session.challengeId,
            personId: session.personId,
            changedFields: ["sessionEndedAt"],
          },
        },
        tx,
      );
    });
    return { ok: true };
  }
}

/** A record that passed every re-check, as the routes read it. */
function formSessionOf(record: SessionRecord, state: HotelFormLinkState): FormSession {
  if (record.request === null || state === "not_active") throw hotelFormSessionError("not_active");
  return {
    challengeId: record.challengeId,
    requestId: record.requestId,
    personId: record.person.id,
    person: { fullName: record.person.fullName, designation: record.person.designation },
    request: record.request,
    state,
  };
}
