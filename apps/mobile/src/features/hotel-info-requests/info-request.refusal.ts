import { isAppError } from "@ampm/core";

import { isRequestDraftField, type RequestErrors } from "./info-request.form";

/** What a refused write says: the API's message, and the details it placed on fields. */
export interface RequestRefusal {
  readonly message: string;
  readonly fields: RequestErrors;
}

/**
 * A refused write in the sheet's words: the API's own message (a 409 names the live request, a 400 the
 * date an extension may reach), each detail under the field its path names, and `fallback` for an error
 * that is not the API's.
 *
 * @example
 * refusalOf(error, "Could not create the request"); // { message, fields: { recipientEmail: "…" } }
 */
export function refusalOf(error: unknown, fallback: string): RequestRefusal {
  if (!isAppError(error)) return { message: fallback, fields: {} };
  const fields: RequestErrors = {};
  for (const detail of error.details ?? []) {
    const key = detail.path?.split(".")[0] ?? "";
    if (isRequestDraftField(key)) fields[key] ??= detail.message;
  }
  return { message: error.message, fields };
}
