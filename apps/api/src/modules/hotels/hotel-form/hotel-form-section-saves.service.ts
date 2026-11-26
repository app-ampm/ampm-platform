import { Injectable } from "@nestjs/common";
import {
  AppError,
  errors,
  HOTEL_FORM_ERRORS,
  HOTEL_FORM_SCHEMA_VERSIONS,
  HOTEL_FORM_SECTION_DRAFTS,
  HOTEL_FORM_SECTION_MAX_BYTES,
  hotelFormSectionConflictDetails,
  hotelFormSectionTooLargeDetails,
  isHotelFormSectionComplete,
  type HotelFormSectionAnswers,
  type HotelFormSectionKey,
  type HotelFormSectionSaved,
  type HotelFormSectionSaveRequest,
} from "@ampm/core";
import type { z } from "zod";

import type { Prisma } from "../../../generated/prisma/client.js";
import { canonicalContentOf } from "./hotel-form-content.js";
import { HotelFormLimits } from "./hotel-form-limits.js";
import { HotelFormRequestsRepository } from "./hotel-form-requests.repository.js";
import {
  HotelFormSectionsRepository,
  type SectionRow,
  type SectionWrite,
} from "./hotel-form-sections.repository.js";
import type { FormSession } from "./hotel-form-sessions.service.js";
import { inForm, isEditableStatus, readOnlyRefusal } from "./hotel-form-submission-state.js";
import { HotelFormSubmissionsRepository } from "./hotel-form-submissions.repository.js";

/** Each section's draft, typed so a key's parse gives that section's answers. */
const DRAFTS: { readonly [K in HotelFormSectionKey]: z.ZodType<HotelFormSectionAnswers[K]> } =
  HOTEL_FORM_SECTION_DRAFTS;

/** What a save naming a version of a section never saved is refused with, on `expectedVersion`. */
const NEVER_SAVED = "This section has not been saved yet: send version 0";

/** A save's answer from what it wrote. */
const savedAs = (version: number, write: SectionWrite): HotelFormSectionSaved => ({
  version,
  isComplete: write.isComplete,
  contentHash: write.contentHash,
});

/** A save's answer from the section as it stands. */
const savedFrom = (row: SectionRow): HotelFormSectionSaved => ({
  version: row.version,
  isComplete: row.isComplete,
  contentHash: row.contentHash,
});

/** Whether a save changes nothing: the same content and the same No changes. */
const isUnchanged = (row: SectionRow, write: SectionWrite): boolean =>
  row.contentHash === write.contentHash && row.noChanges === write.noChanges;

/** 409 `sectionConflict`: the section as a colleague saved it, for Keep mine or Take theirs. */
function conflictWith<K extends HotelFormSectionKey>(key: K, row: SectionRow): AppError {
  const answers = DRAFTS[key].safeParse(row.answers);
  if (!answers.success) return errors.internal(`The saved ${key} section no longer reads`);
  const details = hotelFormSectionConflictDetails({
    section: key,
    version: row.version,
    answers: answers.data,
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
 * over the section's cap is 400 sectionTooLarge. Then, under the request's lock, the first save makes the
 * row at version 1 from `expectedVersion` 0, and a later one writes the next version only from the current
 * one: an unchanged content writes nothing and answers the version as it stands, and a stale version is
 * 409 sectionConflict carrying the colleague's save, as is a first save that lost the race to another.
 * "No changes" is a refresh's only. A save writes no event and no audit (an autosave of a staged draft).
 */
@Injectable()
export class HotelFormSectionSaves {
  constructor(
    private readonly requests: HotelFormRequestsRepository,
    private readonly submissions: HotelFormSubmissionsRepository,
    private readonly sections: HotelFormSectionsRepository,
    private readonly limits: HotelFormLimits,
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
      isComplete: isHotelFormSectionComplete(key, body.answers, body.noChanges),
      noChanges: body.noChanges,
      editorPersonId: session.personId,
      at: now,
    };
    return this.requests.transaction((tx) =>
      this.saveLocked(session.requestId, key, body, write, tx),
    );
  }

  /** The save under the request's lock: the state, No changes, then the first or the next version. */
  private async saveLocked<K extends HotelFormSectionKey>(
    requestId: string,
    key: K,
    body: HotelFormSectionSaveRequest<K>,
    write: SectionWrite,
    tx: Prisma.TransactionClient,
  ): Promise<HotelFormSectionSaved> {
    const request = inForm(await this.submissions.lock(requestId, tx));
    if (!isEditableStatus(request.status)) throw readOnlyRefusal(request);
    if (body.noChanges && request.kind !== "refresh") {
      const detail = { path: "noChanges", message: HOTEL_FORM_ERRORS.noChangesOnOnboarding };
      throw errors.validation([detail], HOTEL_FORM_ERRORS.noChangesOnOnboarding);
    }
    const current = await this.sections.find(requestId, key, tx);
    if (current !== null) return this.saveNext(requestId, key, body, current, write, tx);
    if (body.expectedVersion !== 0) {
      throw errors.validation([{ path: "expectedVersion", message: NEVER_SAVED }], NEVER_SAVED);
    }
    if (await this.sections.createFirst(requestId, key, write, tx)) return savedAs(1, write);
    // A colleague's first save got there first (the unique key held): theirs stands.
    const winner = await this.sections.find(requestId, key, tx);
    if (winner === null) throw errors.internal("The section could not be saved");
    if (isUnchanged(winner, write)) return savedFrom(winner);
    throw conflictWith(key, winner);
  }

  /** A later save: unchanged answers the section as it stands; else only from the current version. */
  private async saveNext<K extends HotelFormSectionKey>(
    requestId: string,
    key: K,
    body: HotelFormSectionSaveRequest<K>,
    current: SectionRow,
    write: SectionWrite,
    tx: Prisma.TransactionClient,
  ): Promise<HotelFormSectionSaved> {
    if (isUnchanged(current, write)) return savedFrom(current);
    if (body.expectedVersion !== current.version) throw conflictWith(key, current);
    const written = await this.sections.updateIf(requestId, key, current.version, write, tx);
    if (written === 1) return savedAs(current.version + 1, write);
    throw conflictWith(key, (await this.sections.find(requestId, key, tx)) ?? current);
  }
}
