import {
  AppError,
  UPLOAD_REFUSAL_MESSAGES,
  uploadRefusalErrorCode,
  type UploadRefusalReason,
} from "@ampm/core";

/*
 * How a refused upload is answered and logged (D-187 §3), for documents and media alike. The person who
 * uploaded the file reads the reason's message from @ampm/core, on the response and on the file field;
 * the content checks' `detail` names the exact rule for the logs only, and may quote what the file
 * itself said (a part name, a link's target), so it is logged with every quoted value masked.
 */

/** The longest detail a log line carries. */
const MAX_DETAIL_LENGTH = 200;

/**
 * The error an upload route answers a refusal with: 415 for a type the upload does not take, 400 for
 * anything refused inside a type it takes, each with the core message, also on `file`.
 *
 * @example
 * if (!result.ok) throw uploadRefusal(result.reason);
 */
export function uploadRefusal(reason: UploadRefusalReason): AppError {
  const message = UPLOAD_REFUSAL_MESSAGES[reason];
  return new AppError(uploadRefusalErrorCode(reason), message, [{ path: "file", message }]);
}

/**
 * A refusal's detail as a log line carries it: every quoted value masked (the checks quote whatever
 * they read from the file, a link's target or an entry's name, which may name a person or a folder),
 * and at most 200 characters.
 *
 * @example
 * loggableDetail('an external image target "file:///C:/Users/…/lawn.jpg"'); // 'an external image target "…"'
 */
export function loggableDetail(detail: string): string {
  return detail.replace(/"(?:[^"\\]|\\.)*"/g, '"…"').slice(0, MAX_DETAIL_LENGTH);
}
