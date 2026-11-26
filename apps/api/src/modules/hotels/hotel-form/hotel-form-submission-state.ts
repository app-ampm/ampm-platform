import {
  AppError,
  HOTEL_FORM_ERRORS,
  hotelFormReadOnlyDetails,
  hotelFormRequestStatus,
  hotelFormSessionError,
  type HotelFormReadOnly,
  type HotelFormRequestStatus,
  type HotelInfoRequestStatus,
} from "@ampm/core";

import type { FormSubmission } from "./hotel-form-submissions.repository.js";

/*
 * Which of a request's states take what (D-190 §3; 7a's status machine, plan §7), pure. Open and changes
 * requested are editable: sections save and the form can be submitted. Submitted and in review are locked:
 * the draft reads, a correction goes, consent can be withdrawn, nothing else. Merged (inside its window) is
 * status-only, likewise. A save or submit refused for the state names who submitted and when.
 */

/**
 * Whether a request's draft takes changes and a submit: open, or changes requested.
 *
 * @example
 * if (!isEditableStatus(request.status)) throw readOnlyRefusal(request);
 */
export function isEditableStatus(status: HotelInfoRequestStatus): boolean {
  return status === "open" || status === "changes_requested";
}

/**
 * The status of a request read under its lock as the form still sees it. One that left the form since the
 * session guard passed (gone, revoked, rejected, its hotel deleted) is the session's 401 `not_active`, the
 * answer the guard gives on the next call.
 */
export function formStatusOf(submission: FormSubmission | null): HotelFormRequestStatus {
  const status = hotelFormRequestStatus.safeParse(submission?.status);
  if (submission === null || submission.hotelDeleted || !status.success) {
    throw hotelFormSessionError("not_active");
  }
  return status.data;
}

/**
 * The request read under its lock, while the form still sees it; otherwise the session's 401 `not_active`.
 *
 * @example
 * const request = inForm(await submissions.lock(session.requestId, tx));
 */
export function inForm(submission: FormSubmission | null): FormSubmission {
  if (submission === null) throw hotelFormSessionError("not_active");
  formStatusOf(submission);
  return submission;
}

/** Who submitted the request and when, as a 409 of a request no longer open to changes carries them. */
export function readOnlyOf(submission: FormSubmission | null): HotelFormReadOnly {
  const status = formStatusOf(submission);
  return {
    status,
    submittedBy: submission?.submittedBy ?? null,
    submittedAt: submission?.submittedAt?.toISOString() ?? null,
  };
}

/**
 * 409 `readOnly`: a section's save on a request submitted, in review, or showing its status only.
 *
 * @example
 * throw readOnlyRefusal(await submissions.find(session.requestId));
 */
export function readOnlyRefusal(submission: FormSubmission | null): AppError {
  const details = hotelFormReadOnlyDetails(readOnlyOf(submission));
  return new AppError("conflict", HOTEL_FORM_ERRORS.readOnly, details);
}

/**
 * 409 `alreadySubmitted`: a submit on a request that is not open to one, and is not the submit that
 * locked it again; the details say who submitted and when, as a save's `readOnly` does.
 */
export function alreadySubmittedRefusal(submission: FormSubmission): AppError {
  const details = hotelFormReadOnlyDetails(readOnlyOf(submission));
  return new AppError("conflict", HOTEL_FORM_ERRORS.alreadySubmitted, details);
}
