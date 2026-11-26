import { Injectable } from "@nestjs/common";
import {
  AppError,
  errors,
  HOTEL_FORM_ERRORS,
  HOTEL_FORM_SCHEMA_VERSIONS,
  HOTEL_FORM_SECTION_MAX_BYTES,
  hotelFormSectionConflictDetails,
  hotelFormSectionTooLargeDetails,
  isHotelFormSectionComplete,
  type HotelFormSectionKey,
  type HotelFormSectionSaved,
  type HotelFormSectionSaveRequest,
} from "@ampm/core";

import type { Prisma } from "../../../generated/prisma/client.js";
import { canonicalContentOf } from "./hotel-form-content.js";
import { HotelFormLimits } from "./hotel-form-limits.js";
import { requireOpenSession } from "./hotel-form-open-session.js";
import { HotelFormRequestsRepository } from "./hotel-form-requests.repository.js";
import {
  HotelFormSectionsRepository,
  type SectionRow,
  type SectionWrite,
} from "./hotel-form-sections.repository.js";
import { HotelFormSessionsRepository } from "./hotel-form-sessions.repository.js";
import type { FormSession } from "./hotel-form-sessions.service.js";
import { storedAnswersOf } from "./hotel-form-stored-answers.js";
import { inForm, isEditableStatus, readOnlyRefusal } from "./hotel-form-submission-state.js";
import { HotelFormSubmissionsRepository } from "./hotel-form-submissions.repository.js";

/** One save as the lock takes it: who saves which section, the body, and what it would write. */
interface SaveCall<K extends HotelFormSectionKey> {
  readonly session: FormSession;
  readonly key: K;
  readonly body: HotelFormSectionSaveRequest<K>;
  readonly write: SectionWrite;
}

/** What a save naming a version of a section never saved is refused with, on `expectedVersion`. */
const NEVER_SAVED = "This section has not been saved yet: send version 0";

/** A save's answer from what it wrote: the saver is the last editor, now. */
const savedAs = (version: number, write: SectionWrite, saver: string): HotelFormSectionSaved => ({
  version,
  isComplete: write.isComplete,
  contentHash: write.contentHash,
  lastEditedBy: saver,
  lastEditedAt: write.at.toISOString(),
});

/**
 * A save's answer from the section as it stands, which may be a colleague's: completeness counted from
 * its stored answers by the current schema, and its last editor and time as stored.
 */
const savedFrom = (key: HotelFormSectionKey, row: SectionRow): HotelFormSectionSaved => ({
  version: row.version,
  isComplete: isHotelFormSectionComplete(key, row.answers, row.noChanges),
  contentHash: row.contentHash,
  lastEditedBy: row.lastEditedBy,
  lastEditedAt: row.lastEditedAt.toISOString(),
});

/**
 * Whether a save changes nothing: the same content, the same No changes and the same schema version (a
 * section saved under another version is written again, so its row records the version it now follows).
 */
const isUnchanged = (row: SectionRow, write: SectionWrite): boolean =>
  row.contentHash === write.contentHash &&
  row.noChanges === write.noChanges &&
  row.schemaVersion === write.schemaVersion;

/**
 * 409 `sectionConflict`: the section as a colleague saved it, for Keep mine or Take theirs. Stored answers
 * that no longer read under the current schema go as the draft's empty answers, as the draft answers
 * them, so the choice is still offered and Keep mine replaces them (review fix D3).
 */
function conflictWith<K extends HotelFormSectionKey>(key: K, row: SectionRow): AppError {
  const details = hotelFormSectionConflictDetails({
    section: key,
    version: row.version,
    answers: storedAnswersOf(key, row).answers,
    noChanges: row.noChanges,
    editedBy: row.lastEditedBy,
    editedAt: row.lastEditedAt.toISOString(),
  });
  return new AppError("conflict", HOTEL_FORM_ERRORS.sectionConflict, details);
}

/**
 * A section's autosave (D-190 §3), `PUT /hotel-form/draft/sections/:sectionKey`. Only while the request
 * is open or awaiting changes (else 409 readOnly, naming who submitted and when); each save counted
 * against the session's 30 a minute and the request's 600 an hour first. The answers, already read through
 * the section's draft, are kept as their canonical JSON, so a null and a missing answer are one content;
 * over the section's cap is 400 sectionTooLarge. Then, under the request's lock, the session is checked
 * again (401 session_ended once a withdrawal of every consent ended it since the guard ran:
 * requireOpenSession), the first save makes the row at version 1 from `expectedVersion` 0, and a later
 * one writes the next version only from the current one: an unchanged content writes nothing and answers
 * the version as it stands, and a stale version is 409 sectionConflict carrying the colleague's save, as
 * is a first save that lost the race to another.
 * "No changes" is a refresh's only. A save writes no event and no audit (an autosave of a staged draft).
 */
@Injectable()
export class HotelFormSectionSaves {
  constructor(
    private readonly requests: HotelFormRequestsRepository,
    private readonly submissions: HotelFormSubmissionsRepository,
    private readonly sections: HotelFormSectionsRepository,
    private readonly limits: HotelFormLimits,
    private readonly sessions: HotelFormSessionsRepository,
  ) {}

  async save<K extends HotelFormSectionKey>(
    session: FormSession,
    key: K,
    body: HotelFormSectionSaveRequest<K>,
    now: Date = new Date(),
  ): Promise<HotelFormSectionSaved> {
    if (session.state !== "ready") {
      throw readOnlyRefusal(await this.submissions.find(session.requestId));
    }
    await this.limits.allowSectionSave(session.challengeId, session.requestId);
    const content = canonicalContentOf(body.answers);
    if (content.bytes > HOTEL_FORM_SECTION_MAX_BYTES[key]) {
      throw new AppError(
        "validation_failed",
        HOTEL_FORM_ERRORS.sectionTooLarge,
        hotelFormSectionTooLargeDetails(key),
      );
    }
    const write: SectionWrite = {
      schemaVersion: HOTEL_FORM_SCHEMA_VERSIONS[key],
      answers: content.json,
      contentHash: content.hash,
      // Counted from the answers as stored, so this answer, the stored flag and the next read agree.
      isComplete: isHotelFormSectionComplete(key, content.json, body.noChanges),
      noChanges: body.noChanges,
      editorPersonId: session.personId,
      at: now,
    };
    const call: SaveCall<K> = { session, key, body, write };
    return this.requests.transaction((tx) => this.saveLocked(call, tx));
  }

  /** The save under the request's lock: the state, No changes, then the first or the next version. */
  private async saveLocked<K extends HotelFormSectionKey>(
    call: SaveCall<K>,
    tx: Prisma.TransactionClient,
  ): Promise<HotelFormSectionSaved> {
    const { session, key, body, write } = call;
    const requestId = session.requestId;
    const request = inForm(await this.submissions.lock(requestId, tx));
    await requireOpenSession(this.sessions, session, tx);
    if (!isEditableStatus(request.status)) throw readOnlyRefusal(request);
    if (body.noChanges && request.kind !== "refresh") {
      const detail = { path: "noChanges", message: HOTEL_FORM_ERRORS.noChangesOnOnboarding };
      throw errors.validation([detail], HOTEL_FORM_ERRORS.noChangesOnOnboarding);
    }
    const current = await this.sections.find(requestId, key, tx);
    if (current !== null) return this.saveNext(call, current, tx);
    if (body.expectedVersion !== 0) {
      throw errors.validation([{ path: "expectedVersion", message: NEVER_SAVED }], NEVER_SAVED);
    }
    if (await this.sections.createFirst(requestId, key, write, tx)) {
      return savedAs(1, write, session.person.fullName);
    }
    // A colleague's first save got there first (the unique key held): theirs stands.
    const winner = await this.sections.find(requestId, key, tx);
    if (winner === null) throw errors.internal("The section could not be saved");
    if (isUnchanged(winner, write)) return savedFrom(key, winner);
    throw conflictWith(key, winner);
  }

  /** A later save: unchanged answers the section as it stands; else only from the current version. */
  private async saveNext<K extends HotelFormSectionKey>(
    { session, key, body, write }: SaveCall<K>,
    current: SectionRow,
    tx: Prisma.TransactionClient,
  ): Promise<HotelFormSectionSaved> {
    const requestId = session.requestId;
    if (isUnchanged(current, write)) return savedFrom(key, current);
    if (body.expectedVersion !== current.version) throw conflictWith(key, current);
    const written = await this.sections.updateIf(requestId, key, current.version, write, tx);
    if (written === 1) return savedAs(current.version + 1, write, session.person.fullName);
    throw conflictWith(key, (await this.sections.find(requestId, key, tx)) ?? current);
  }
}
