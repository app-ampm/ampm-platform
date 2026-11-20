import { isAppError } from "@ampm/core";

const UNEXPECTED = "Something went wrong. Please try again.";

/**
 * A refused request as the client sign-in screens say it. The API already words its sign-in refusals
 * for people (`SIGN_IN_ERRORS`: a wrong or expired code, too soon, too many codes; D-147), and the
 * client turns a lost connection into "Could not reach the server", so those show as they come; a body
 * the schema refused says what to fix instead.
 *
 *   refusalText(signIn.error, "Enter the 6-digit code") // "That code didn't work. …"
 */
export function refusalText(error: unknown, invalidInput: string): string | undefined {
  if (!error) return undefined;
  if (isAppError(error) && error.code === "validation_failed") return invalidInput;
  return error instanceof Error && error.message.length > 0 ? error.message : UNEXPECTED;
}
