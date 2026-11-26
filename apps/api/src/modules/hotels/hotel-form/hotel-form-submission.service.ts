import { Inject, Injectable } from "@nestjs/common";
import {
  AppError,
  checkSubmit,
  errors,
  HOTEL_FORM_ACCURACY_VERSION,
  HOTEL_FORM_DISPLAY_VERSION,
  HOTEL_FORM_ERRORS,
  HOTEL_FORM_SUBMIT_ACTION,
  hotelFormMissingItemDetails,
  type HotelFormSubmitRequest,
  type HotelFormSubmitted,
} from "@ampm/core";
import { canTransition } from "@ampm/policy";

import {
  BOT_CHECK_ADAPTER,
  type BotCheckAdapter,
} from "../../../common/bot-check/bot-check.adapter.js";
import { ENV, type Env } from "../../../env.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { HotelInfoRequestJournal } from "../hotel-info-request-journal.js";
import { HotelInfoRequestsRepository } from "../hotel-info-requests.repository.js";
import { hotelFormBotPasses, hotelFormBotRefusal } from "./hotel-form-bot-check.js";
import type { CanonicalContent } from "./hotel-form-content.js";
import { HotelFormPeopleRepository } from "./hotel-form-people.repository.js";
import { HotelFormRequestsRepository } from "./hotel-form-requests.repository.js";
import {
  changedSectionsOf,
  revisionHashOrNull,
  revisionOf,
  savedSectionsOf,
  sectionsChangedRefusal,
} from "./hotel-form-submission-sections.js";
import { HotelFormSectionsRepository } from "./hotel-form-sections.repository.js";
import type { FormSession } from "./hotel-form-sessions.service.js";
import { HotelFormStaffNotices } from "./hotel-form-staff-notices.js";
import {
  alreadySubmittedRefusal,
  inForm,
  isEditableStatus,
} from "./hotel-form-submission-state.js";
import {
  HotelFormSubmissionsRepository,
  type FormSubmission,
} from "./hotel-form-submissions.repository.js";

/** The §7 machine a submit moves, as the System (permission-matrix §7 "Hotel information request"). */
const MACHINE = "hotel_info_request";
/** The two declarations a submit records, as its audit names them. */
const DECLARATION_KINDS = ["accuracy_attestation", "display_authorisation"];
/** The request's columns a submit changes, as its audit names them. */
const SUBMIT_FIELDS = ["status", "revision", "submittedAt", "submittedByPersonId"];

/** What a submit found and did: a fresh submit tells staff after it commits; a repeat tells no one. */
interface Outcome {
  readonly fresh: boolean;
  readonly answer: HotelFormSubmitted;
}

/** What one submit call carries beside its body. */
interface Call {
  readonly session: FormSession;
  readonly body: HotelFormSubmitRequest;
  readonly human: boolean;
  readonly ip: string | null;
  readonly now: Date;
}

/**
 * `POST /hotel-form/submit` (D-190 §3). The Turnstile pass for `hf_submit` is verified first, outside the
 * transaction (the provider gets 5 seconds, and no row is held meanwhile); then, under the request's
 * lock: a request still open (or awaiting changes) needs both declarations in the words in force (409
 * noticeStale), the pass (400), every section at the version the review page read (409 sectionsChanged,
 * naming the ones a colleague saved since) and the strict check (400 submitIncomplete, every missing item); then
 * revision n+1 holds every section and its hash, 7.4 and 7.5 are recorded against that hash, the System
 * moves the request to submitted through a conditional write (its revision, time and submitter set), and
 * the `submitted` event and an allow-listed audit are written. Staff are told after the commit. A request
 * no longer open answers a repeat of the submit that locked it with that submit's answer, writing nothing
 * (see `repeatOf`), and anything else with 409 alreadySubmitted.
 */
@Injectable()
export class HotelFormSubmission {
  constructor(
    private readonly requests: HotelFormRequestsRepository,
    private readonly submissions: HotelFormSubmissionsRepository,
    private readonly sections: HotelFormSectionsRepository,
    private readonly people: HotelFormPeopleRepository,
    private readonly infoRequests: HotelInfoRequestsRepository,
    private readonly journal: HotelInfoRequestJournal,
    private readonly notices: HotelFormStaffNotices,
    @Inject(BOT_CHECK_ADAPTER) private readonly botCheck: BotCheckAdapter,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async submit(
    session: FormSession,
    body: HotelFormSubmitRequest,
    ip: string | null,
    now: Date = new Date(),
  ): Promise<HotelFormSubmitted> {
    const site = this.env.PUBLIC_SITE_URL;
    // A session that saw the request locked can only repeat a submit: no pass is spent on it.
    const human =
      session.state === "ready" &&
      (await hotelFormBotPasses(this.botCheck, site, body.botToken, ip, HOTEL_FORM_SUBMIT_ACTION));
    const call: Call = { session, body, human, ip, now };
    const outcome = await this.requests.transaction((tx) => this.submitLocked(call, tx));
    if (outcome.fresh) await this.notices.submitted(session.requestId);
    return outcome.answer;
  }

  private async submitLocked(call: Call, tx: Prisma.TransactionClient): Promise<Outcome> {
    const request = inForm(await this.submissions.lock(call.session.requestId, tx));
    if (!isEditableStatus(request.status)) {
      return { fresh: false, answer: await this.repeatOf(request, call.body, tx) };
    }
    const { accuracy, display } = call.body;
    if (
      accuracy.textVersion !== HOTEL_FORM_ACCURACY_VERSION ||
      display.textVersion !== HOTEL_FORM_DISPLAY_VERSION
    ) {
      throw errors.conflict(HOTEL_FORM_ERRORS.noticeStale);
    }
    if (!call.human) throw hotelFormBotRefusal();
    const rows = await this.sections.list(request.id, tx);
    const changed = changedSectionsOf(rows, call.body.sectionVersions);
    if (changed.length > 0) throw sectionsChangedRefusal(changed);
    const missing = checkSubmit({ kind: request.kind, sections: savedSectionsOf(rows) });
    if (missing.length > 0) {
      const details = hotelFormMissingItemDetails(missing);
      throw new AppError("validation_failed", HOTEL_FORM_ERRORS.submitIncomplete, details);
    }
    await this.record(request, revisionOf(rows), call, tx);
    const answer = {
      reference: request.reference,
      status: "submitted" as const,
      submittedAt: call.now.toISOString(),
    };
    return { fresh: true, answer };
  }

  /** The revision, the declarations bound to its hash, the System's move, the event and the audit. */
  private async record(
    request: FormSubmission,
    content: CanonicalContent,
    { session, body, ip, now }: Call,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const revision = request.revision + 1;
    const personId = session.personId;
    const revisionId = await this.submissions.createRevision(
      {
        requestId: request.id,
        revision,
        answers: content.json,
        answersHash: content.hash,
        submittedByPersonId: personId,
        submittedAt: now,
      },
      tx,
    );
    const consentIds = await this.people.addDeclarations(
      {
        personId,
        revisionHash: content.hash,
        accuracyVersion: body.accuracy.textVersion,
        displayVersion: body.display.textVersion,
        display: body.display.answer,
        ipAddress: ip,
        at: now,
      },
      tx,
    );
    await this.moveToSubmitted(request, revision, personId, now, tx);
    const submitted = { revision, revisionId, consentIds, answersHash: content.hash };
    await this.journalSubmit(request.id, personId, submitted, now, tx);
  }

  /** The `submitted` event, naming the revision, and the person's allow-listed audit of the submit. */
  private async journalSubmit(
    requestId: string,
    personId: string,
    submitted: {
      readonly revision: number;
      readonly revisionId: string;
      readonly consentIds: readonly string[];
      readonly answersHash: string;
    },
    now: Date,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const { revision, revisionId, consentIds, answersHash } = submitted;
    const actor = { kind: "hotel_person" as const, personId };
    const detail = { revision };
    await this.journal.event({ requestId, eventType: "submitted", actor, at: now, detail }, tx);
    const after = {
      id: requestId,
      revisionId,
      personId,
      consentIds,
      revision,
      answersHash,
      kinds: DECLARATION_KINDS,
      changedFields: SUBMIT_FIELDS,
    };
    await this.journal.record(requestId, { action: "update", after }, tx);
  }

  /** Open or changes requested → submitted, as the System, only while the request is still as read. */
  private async moveToSubmitted(
    request: FormSubmission,
    revision: number,
    personId: string,
    now: Date,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    if (!canTransition({ type: "system" }, MACHINE, request.status, "submitted")) {
      throw alreadySubmittedRefusal(request);
    }
    const written = await this.infoRequests.updateIf(
      request.id,
      { statuses: [request.status] },
      { status: "submitted", revision, submittedAt: now, submittedByPersonId: personId },
      tx,
    );
    if (written !== 1) throw alreadySubmittedRefusal(request);
  }

  /**
   * A submit on a request no longer open. It repeats the submit that locked the request (a double click,
   * or a colleague who agrees) when the request still awaits review, its sections stand at the versions
   * the caller's review page read and still hash to the latest revision, and the declarations it carries
   * are the ones that revision's submitter recorded: that submit's answer, nothing written. Otherwise 409
   * alreadySubmitted: AMPM moved the request on, or the caller read other answers or declared otherwise,
   * which is never dropped silently as if recorded.
   */
  private async repeatOf(
    request: FormSubmission,
    body: HotelFormSubmitRequest,
    tx: Prisma.TransactionClient,
  ): Promise<HotelFormSubmitted> {
    const latest = await this.submissions.latestRevision(request.id, tx);
    const rows = await this.sections.list(request.id, tx);
    const submittedAt = request.submittedAt;
    if (
      request.status !== "submitted" ||
      submittedAt === null ||
      latest === null ||
      latest.revision !== request.revision ||
      changedSectionsOf(rows, body.sectionVersions).length > 0 ||
      revisionHashOrNull(rows) !== latest.answersHash
    ) {
      throw alreadySubmittedRefusal(request);
    }
    const declared = await this.people.declarationsOf(
      latest.submittedByPersonId,
      latest.answersHash,
      tx,
    );
    const accuracy = declared.find((row) => row.kind === "accuracy_attestation");
    const display = declared.find((row) => row.kind === "display_authorisation");
    const same =
      accuracy?.textVersion === body.accuracy.textVersion &&
      display?.textVersion === body.display.textVersion &&
      display.granted === (body.display.answer === "yes");
    if (!same) throw alreadySubmittedRefusal(request);
    return {
      reference: request.reference,
      status: "submitted",
      submittedAt: submittedAt.toISOString(),
    };
  }
}
