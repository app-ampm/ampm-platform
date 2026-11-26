import { createHash } from "node:crypto";

import { canonicalJson, type HotelFormSectionKey } from "@ampm/core";
import { vi } from "vitest";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { SectionRow } from "../hotel-form/hotel-form-sections.repository.js";
import type { HotelFormSessionsRepository } from "../hotel-form/hotel-form-sessions.repository.js";
import type { FormSession } from "../hotel-form/hotel-form-sessions.service.js";
import type {
  FormSubmission,
  HotelFormSubmissionsRepository,
  NewRevision,
  NoticeSubject,
  RevisionRow,
} from "../hotel-form/hotel-form-submissions.repository.js";
import {
  FORM_LATER,
  FORM_NOW,
  FORM_PERSON_ID,
  FORM_REQUEST_ID,
  FORM_TX,
  linkedRequest,
} from "./hotel-form-fixtures.js";

/*
 * Synthetic hotel form state for the draft's, the submit's, the corrections' and the withdrawal's unit
 * specs (D-190): a signed-in session, a request's submission, saved sections and a submissions repository
 * whose transactions run at once. Made-up names and hotels only. Test-only: the build leaves `testing/`
 * folders out.
 */

export const FORM_CHALLENGE_ID = "0192f1a0-0000-7000-8000-0000000000c1";
export const FORM_COLLEAGUE_ID = "0192f1a0-0000-7000-8000-0000000000d2";
export const FORM_REVISION_ID = "0192f1a0-0000-7000-8000-0000000000e1";
export const FORM_REFERENCE = "HIR-2026-0042";
export const FORM_EARLIER = new Date("2026-11-25T09:00:00.000Z");

const { tokenHash: _stored, ...REQUEST } = linkedRequest();

/** A signed-in person's session on the spec request, in `state` (ready unless told). */
export function formSession(overrides: Partial<FormSession> = {}): FormSession {
  return {
    challengeId: FORM_CHALLENGE_ID,
    requestId: FORM_REQUEST_ID,
    personId: FORM_PERSON_ID,
    person: { fullName: "Synthetic Person", designation: "General Manager" },
    request: REQUEST,
    state: "ready",
    ...overrides,
  };
}

/** The spec request's submission: an open onboarding request, never submitted unless told. */
export function formSubmission(overrides: Partial<FormSubmission> = {}): FormSubmission {
  return {
    ...REQUEST,
    reference: FORM_REFERENCE,
    kind: "onboarding",
    revision: 0,
    submittedAt: null,
    submittedBy: null,
    ...overrides,
  };
}

/** The spec request submitted once, by the person, an hour ago. */
export function submittedRequest(overrides: Partial<FormSubmission> = {}): FormSubmission {
  return formSubmission({
    status: "submitted",
    revision: 1,
    submittedAt: FORM_EARLIER,
    submittedBy: "Synthetic Person",
    ...overrides,
  });
}

/** The SHA-256 of answers' canonical JSON, as the API stores a content or answers hash. */
export function hashOf(answers: unknown): string {
  return createHash("sha256").update(canonicalJson(answers)).digest("hex");
}

/** A saved section holding `answers` (stored as canonical JSON), at `version`, by a colleague. */
export function sectionRow(
  sectionKey: HotelFormSectionKey,
  answers: Prisma.InputJsonObject,
  overrides: Partial<SectionRow> = {},
): SectionRow {
  const stored: Prisma.JsonValue = JSON.parse(canonicalJson(answers));
  return {
    sectionKey,
    schemaVersion: 1,
    answers: stored,
    contentHash: hashOf(answers),
    version: 1,
    isComplete: false,
    noChanges: false,
    lastEditedAt: FORM_EARLIER,
    lastEditedBy: "Synthetic Colleague",
    ...overrides,
  };
}

/** A submissions repository whose request is `locked` under the lock and `found` outside it. */
export function formSubmissions(
  locked: FormSubmission | null = formSubmission(),
  found: FormSubmission | null = locked,
) {
  type Tx = Prisma.TransactionClient;
  type Correction = {
    readonly requestId: string;
    readonly personId: string;
    readonly message: string;
  };
  const repository = {
    find: vi.fn(async (_requestId: string) => found),
    lock: vi.fn(async (_requestId: string, _tx: Tx) => locked),
    latestRevision: vi.fn(async (_requestId: string, _tx: Tx): Promise<RevisionRow | null> => null),
    createRevision: vi.fn(async (_revision: NewRevision, _tx: Tx) => FORM_REVISION_ID),
    createCorrection: vi.fn(
      async (_correction: Correction, _tx: Tx) => "0192f1a0-0000-7000-8000-0000000000f1",
    ),
    hasRemovalRequest: vi.fn(async (_requestId: string, _personId: string, _tx: Tx) => false),
    noticeSubject: vi.fn(async (_requestId: string): Promise<NoticeSubject | null> => ({
      reference: FORM_REFERENCE,
      name: "Synthetic Lake Hotel",
    })),
  };
  return { repository, typed: repository as unknown as HotelFormSubmissionsRepository };
}

/**
 * The sessions repository as a call holding the request's lock checks its session again: still open, unless
 * `open` is false (a withdrawal of every consent ended it since the guard ran).
 */
export function formOpenSessions(open = true) {
  const isOpen = vi.fn(
    async (_challengeId: string, _personId: string, _tx: Prisma.TransactionClient) => open,
  );
  return { isOpen, typed: { isOpen } as unknown as HotelFormSessionsRepository };
}

/** A transaction runner as the requests repository's, running `work` at once on the spec client. */
export function formTransactions() {
  return {
    transaction: vi.fn(async <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) =>
      work(FORM_TX),
    ),
  };
}

export { FORM_LATER, FORM_NOW, FORM_PERSON_ID, FORM_REQUEST_ID, FORM_TX };
