import { Injectable } from "@nestjs/common";
import {
  hotelInfoRequestConsentKind,
  type HotelFormWithdrawalRequest,
  type HotelFormWithdrawn,
  type HotelInfoRequestConsentKind,
} from "@ampm/core";

import type { Prisma } from "../../../generated/prisma/client.js";
import { AuditService } from "../../../policy/audit.service.js";
import { HotelInfoRequestJournal, type RequestActor } from "../hotel-info-request-journal.js";
import { HOTEL_FORM_PERSON_ENTITY } from "./hotel-form-enrolment.service.js";
import {
  HotelFormPeopleRepository,
  type WithdrawnConsent,
} from "./hotel-form-people.repository.js";
import { HotelFormRequestsRepository } from "./hotel-form-requests.repository.js";
import type { FormSession } from "./hotel-form-sessions.service.js";
import { HotelFormStaffNotices } from "./hotel-form-staff-notices.js";
import { inForm } from "./hotel-form-submission-state.js";
import { HotelFormSubmissionsRepository } from "./hotel-form-submissions.repository.js";

/** What a withdrawal of `all` takes back: every consent kind, the privacy notice's included. */
const ALL_KINDS: readonly HotelInfoRequestConsentKind[] = hotelInfoRequestConsentKind.options;
/** What a withdrawal of `display_authorisation` takes back: 7.5 alone. */
const DISPLAY_ONLY: readonly HotelInfoRequestConsentKind[] = ["display_authorisation"];

/** What one withdrawal call did, under the request's lock. */
interface Withdrawal {
  readonly withdrawn: readonly WithdrawnConsent[];
  /** A removal request recorded by this call (not one the person made before). */
  readonly removalAskedNow: boolean;
  /** Whether the person's details are asked to be removed, now or before. */
  readonly removalRequested: boolean;
}

/** The kinds withdrawn, each once, in the order the kinds are listed. */
const kindsOf = (withdrawn: readonly WithdrawnConsent[]): HotelInfoRequestConsentKind[] =>
  ALL_KINDS.filter((kind) => withdrawn.some((consent) => consent.kind === kind));

/**
 * `POST /hotel-form/consent-withdrawal` (D-190 §3; plan §9.3: withdrawal as easy as consent): in any state
 * a session reaches, under the request's lock, the person's live consents of the kind (7.5 alone, or
 * every one, the privacy notice's included) are withdrawn as their own act (source `contributor`), and
 * with `requestRemoval` a removal request is recorded, once per person, for a Super Admin to review. Each
 * writes its event (`consent_withdrawn` naming the kind asked, `removal_requested`) and one allow-listed
 * audit of the person (the consents' ids and kinds); the Super Admins are told in-app after the commit.
 * Withdrawing 7.5 is recorded now; the photos it flags arrive in Slice 9. A call that changes nothing
 * writes nothing and tells no one.
 */
@Injectable()
export class HotelFormWithdrawals {
  constructor(
    private readonly requests: HotelFormRequestsRepository,
    private readonly submissions: HotelFormSubmissionsRepository,
    private readonly people: HotelFormPeopleRepository,
    private readonly journal: HotelInfoRequestJournal,
    private readonly audit: AuditService,
    private readonly notices: HotelFormStaffNotices,
  ) {}

  async withdraw(
    session: FormSession,
    body: HotelFormWithdrawalRequest,
    now: Date = new Date(),
  ): Promise<HotelFormWithdrawn> {
    const done = await this.requests.transaction((tx) =>
      this.withdrawLocked(session, body, now, tx),
    );
    if (done.withdrawn.length > 0 || done.removalAskedNow) {
      await this.notices.withdrawal(session.requestId);
    }
    return { withdrawn: kindsOf(done.withdrawn), removalRequested: done.removalRequested };
  }

  private async withdrawLocked(
    session: FormSession,
    body: HotelFormWithdrawalRequest,
    now: Date,
    tx: Prisma.TransactionClient,
  ): Promise<Withdrawal> {
    const request = inForm(await this.submissions.lock(session.requestId, tx));
    const kinds = body.kind === "all" ? ALL_KINDS : DISPLAY_ONLY;
    const withdrawn = await this.people.withdrawLive(session.personId, kinds, now, tx);
    const askedBefore = await this.submissions.hasRemovalRequest(request.id, session.personId, tx);
    const removalAskedNow = body.requestRemoval && !askedBefore;
    const actor: RequestActor = { kind: "hotel_person", personId: session.personId };
    const event = { requestId: request.id, actor, at: now };
    if (withdrawn.length > 0) {
      const detail = { kind: body.kind };
      await this.journal.event({ ...event, eventType: "consent_withdrawn", detail }, tx);
    }
    if (removalAskedNow) await this.journal.event({ ...event, eventType: "removal_requested" }, tx);
    if (withdrawn.length > 0 || removalAskedNow) {
      await this.record(session, request.id, withdrawn, removalAskedNow, tx);
    }
    return { withdrawn, removalAskedNow, removalRequested: removalAskedNow || askedBefore };
  }

  /** The person's audit: the consents' ids and kinds, and the fields changed; never a value. */
  private async record(
    session: FormSession,
    requestId: string,
    withdrawn: readonly WithdrawnConsent[],
    removalAskedNow: boolean,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const changedFields = [
      ...(withdrawn.length > 0 ? ["withdrawnAt", "withdrawalSource"] : []),
      ...(removalAskedNow ? ["removalRequested"] : []),
    ];
    const after = {
      id: session.personId,
      requestId,
      consentIds: withdrawn.map((consent) => consent.id),
      kinds: kindsOf(withdrawn),
      changedFields,
    };
    await this.audit.record(
      { action: "update", entityType: HOTEL_FORM_PERSON_ENTITY, entityId: session.personId, after },
      tx,
    );
  }
}
