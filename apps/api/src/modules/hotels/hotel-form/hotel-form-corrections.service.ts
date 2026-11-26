import { Inject, Injectable } from "@nestjs/common";
import {
  errors,
  HOTEL_FORM_CORRECTION_ACTION,
  HOTEL_FORM_ERRORS,
  type Acknowledged,
  type HotelFormCorrectionRequest,
} from "@ampm/core";

import {
  BOT_CHECK_ADAPTER,
  type BotCheckAdapter,
} from "../../../common/bot-check/bot-check.adapter.js";
import { ENV, type Env } from "../../../env.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { AuditService } from "../../../policy/audit.service.js";
import { HotelInfoRequestJournal } from "../hotel-info-request-journal.js";
import { hotelFormBotPasses, hotelFormBotRefusal } from "./hotel-form-bot-check.js";
import { HotelFormLimits } from "./hotel-form-limits.js";
import { requireOpenSession } from "./hotel-form-open-session.js";
import { HotelFormRequestsRepository } from "./hotel-form-requests.repository.js";
import { HotelFormSessionsRepository } from "./hotel-form-sessions.repository.js";
import type { FormSession } from "./hotel-form-sessions.service.js";
import { HotelFormStaffNotices } from "./hotel-form-staff-notices.js";
import { inForm } from "./hotel-form-submission-state.js";
import {
  HotelFormSubmissionsRepository,
  type FormSubmission,
} from "./hotel-form-submissions.repository.js";

/** The audit's entity for a correction a person asked for. */
export const HOTEL_FORM_CORRECTION_ENTITY = "hotel_info_request_correction";

/** A request that was never submitted has nothing to correct (409). */
function requireSubmitted(request: FormSubmission): void {
  if (request.revision < 1) throw errors.conflict(HOTEL_FORM_ERRORS.notSubmitted);
}

/**
 * `POST /hotel-form/corrections` (D-190 §3): a message for AMPM's Hotel team once the request has been
 * submitted, whatever its state since (in review, status-only after the merge, or awaiting changes); a
 * request never submitted is 409 notSubmitted. In order: that check, the Turnstile pass for
 * `hf_correction` (400), the request's 5 corrections a day (429 correctionLimit). Then, under the request's
 * lock, once the session is checked again (401 session_ended once a withdrawal of every consent ended it
 * since the guard ran: requireOpenSession), the message is stored in its own row (RESTRICTED-CONTACT,
 * read only in the staff app), the `correction_requested` event names it by id and the audit is the
 * person's, neither holding the message; staff are told after the commit, with nothing the hotel typed.
 */
@Injectable()
export class HotelFormCorrections {
  constructor(
    private readonly requests: HotelFormRequestsRepository,
    private readonly submissions: HotelFormSubmissionsRepository,
    private readonly limits: HotelFormLimits,
    private readonly journal: HotelInfoRequestJournal,
    private readonly audit: AuditService,
    private readonly notices: HotelFormStaffNotices,
    private readonly sessions: HotelFormSessionsRepository,
    @Inject(BOT_CHECK_ADAPTER) private readonly botCheck: BotCheckAdapter,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async request(
    session: FormSession,
    body: HotelFormCorrectionRequest,
    ip: string | null,
    now: Date = new Date(),
  ): Promise<Acknowledged> {
    requireSubmitted(inForm(await this.submissions.find(session.requestId)));
    const site = this.env.PUBLIC_SITE_URL;
    const action = HOTEL_FORM_CORRECTION_ACTION;
    if (!(await hotelFormBotPasses(this.botCheck, site, body.botToken, ip, action))) {
      throw hotelFormBotRefusal();
    }
    await this.limits.allowCorrection(session.requestId);
    await this.requests.transaction((tx) => this.store(session, body.message, now, tx));
    await this.notices.correction(session.requestId);
    return { ok: true };
  }

  /** Under the request's lock: the message in its own row, its event and its audit, by id only. */
  private async store(
    session: FormSession,
    message: string,
    now: Date,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const request = inForm(await this.submissions.lock(session.requestId, tx));
    await requireOpenSession(this.sessions, session, tx);
    requireSubmitted(request);
    const { personId } = session;
    const correction = { requestId: request.id, personId, message };
    const correctionId = await this.submissions.createCorrection(correction, tx);
    await this.journal.event(
      {
        requestId: request.id,
        eventType: "correction_requested",
        actor: { kind: "hotel_person", personId },
        at: now,
        detail: { correctionId },
      },
      tx,
    );
    const after = { id: correctionId, requestId: request.id, personId };
    await this.audit.record(
      { action: "create", entityType: HOTEL_FORM_CORRECTION_ENTITY, entityId: correctionId, after },
      tx,
    );
  }
}
