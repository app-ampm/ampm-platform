import {
  HOTEL_FORM_ACCURACY_VERSION,
  HOTEL_FORM_DISPLAY_VERSION,
  hotelFormRevisionAnswersOf,
  type HotelFormSubmitRequest,
} from "@ampm/core";
import { expect, vi } from "vitest";

import type { BotCheckAdapter } from "../../../common/bot-check/bot-check.adapter.js";
import type { Env } from "../../../env.js";
import type { HotelInfoRequestJournal } from "../hotel-info-request-journal.js";
import type { HotelInfoRequestsRepository } from "../hotel-info-requests.repository.js";
import type {
  DeclarationRow,
  HotelFormPeopleRepository,
} from "../hotel-form/hotel-form-people.repository.js";
import type { HotelFormRequestsRepository } from "../hotel-form/hotel-form-requests.repository.js";
import type {
  HotelFormSectionsRepository,
  SectionRow,
} from "../hotel-form/hotel-form-sections.repository.js";
import type { HotelFormStaffNotices } from "../hotel-form/hotel-form-staff-notices.js";
import { HotelFormSubmission } from "../hotel-form/hotel-form-submission.service.js";
import type {
  FormSubmission,
  RevisionRow,
} from "../hotel-form/hotel-form-submissions.repository.js";
import { FORM_SITE } from "./hotel-form-fixtures.js";
import {
  formSubmission,
  formSubmissions,
  formTransactions,
  hashOf,
  sectionRow,
} from "./hotel-form-draft-fixtures.js";

/*
 * The submit's fakes (D-190 §3), shared by its two unit specs: a complete onboarding draft, a body with
 * both declarations, the hash its revision binds to, the declarations a submitter recorded, and the
 * service on fake repositories whose transactions run at once. Synthetic data only. Test-only.
 */

export const COMPLETE: SectionRow[] = [
  sectionRow("property", { name: "Synthetic Lake Palace", city: "Udaipur", state: "Rajasthan" }),
  sectionRow("contact", { contacts: [{ name: "Synthetic Sales", email: "sales@hotel.example" }] }),
];

export const BODY: HotelFormSubmitRequest = {
  accuracy: { accepted: true, textVersion: HOTEL_FORM_ACCURACY_VERSION },
  display: { answer: "yes", textVersion: HOTEL_FORM_DISPLAY_VERSION },
  botToken: "turnstile-pass",
};

/** The hash a submit of `rows` binds to, as the service computes it. */
export function revisionHashOf(rows: readonly SectionRow[]): string {
  const saved = Object.fromEntries(
    rows.map((row) => [
      row.sectionKey,
      { schemaVersion: 1, noChanges: row.noChanges, answers: row.answers },
    ]),
  );
  return hashOf(hotelFormRevisionAnswersOf(saved));
}

export const RECORDED: DeclarationRow[] = [
  { kind: "display_authorisation", textVersion: HOTEL_FORM_DISPLAY_VERSION, granted: true },
  { kind: "accuracy_attestation", textVersion: HOTEL_FORM_ACCURACY_VERSION, granted: true },
];

export interface SubmitOptions {
  readonly locked?: FormSubmission | null;
  readonly rows?: SectionRow[];
  readonly human?: boolean;
  readonly written?: number;
  readonly latest?: RevisionRow | null;
  readonly declared?: DeclarationRow[];
}

export function buildSubmission(options: SubmitOptions = {}) {
  const submissions = formSubmissions(
    options.locked === undefined ? formSubmission() : options.locked,
  );
  submissions.repository.latestRevision.mockResolvedValue(options.latest ?? null);
  const list = vi.fn(async () => options.rows ?? COMPLETE);
  const addDeclarations = vi.fn(async () => ["consent-a", "consent-b"]);
  const declarationsOf = vi.fn(async () => options.declared ?? RECORDED);
  const updateIf = vi.fn(async () => options.written ?? 1);
  const journal = { event: vi.fn(async () => undefined), record: vi.fn(async () => undefined) };
  const submitted = vi.fn(async () => 4);
  const verify = vi.fn(async () => options.human ?? true);
  const service = new HotelFormSubmission(
    formTransactions() as unknown as HotelFormRequestsRepository,
    submissions.typed,
    { list } as unknown as HotelFormSectionsRepository,
    { addDeclarations, declarationsOf } as unknown as HotelFormPeopleRepository,
    { updateIf } as unknown as HotelInfoRequestsRepository,
    journal as unknown as HotelInfoRequestJournal,
    { submitted } as unknown as HotelFormStaffNotices,
    { verify } as unknown as BotCheckAdapter,
    { PUBLIC_SITE_URL: FORM_SITE } as unknown as Env,
  );
  const sub = submissions.repository;
  return {
    service,
    sub,
    list,
    addDeclarations,
    declarationsOf,
    updateIf,
    journal,
    submitted,
    verify,
  };
}

/** The writes a submit makes, all of which a refused one leaves undone. */
export function expectNothingWritten(built: ReturnType<typeof buildSubmission>): void {
  expect(built.sub.createRevision).not.toHaveBeenCalled();
  expect(built.addDeclarations).not.toHaveBeenCalled();
  expect(built.updateIf).not.toHaveBeenCalled();
  expect(built.journal.event).not.toHaveBeenCalled();
  expect(built.submitted).not.toHaveBeenCalled();
}
