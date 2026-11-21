import { ACTIVATION_ERRORS, isAppError } from "@ampm/core";

/** Why an activation that can be tried again did not go through. */
export type ActivationFailure =
  "network" | "rate-limited" | "email-mismatch" | "linked-elsewhere" | "unknown";

/** Where a refused activation leaves the person: a link that no longer works, or a reason to retry. */
export type ActivationRefusal =
  | { readonly kind: "expired" }
  | { readonly kind: "already-active" }
  | { readonly kind: "failed"; readonly reason: ActivationFailure };

/**
 * Reads a refusal of the invite exchange or of `/auth/activate`. The envelope has a code and a message
 * and no finer reason, so the two refusals that end the link are told apart by the messages the API
 * raises (`ACTIVATION_ERRORS`): no live invitation (expired, superseded, or redeemed by an earlier
 * visit) and an account that is no longer invited. Everything else can be tried again.
 *
 *   activationRefusal(error) // { kind: "expired" }
 */
export function activationRefusal(error: unknown): ActivationRefusal {
  if (!isAppError(error)) return { kind: "failed", reason: "unknown" };
  if (error.message === ACTIVATION_ERRORS.invalidInvite) return { kind: "expired" };
  if (error.message === ACTIVATION_ERRORS.inviteUsed) return { kind: "expired" };
  if (error.message === ACTIVATION_ERRORS.alreadyActive) return { kind: "already-active" };
  switch (error.code) {
    case "network_error":
      return { kind: "failed", reason: "network" };
    case "rate_limited":
      return { kind: "failed", reason: "rate-limited" };
    // The provider's verified email is not the invitation's.
    case "forbidden":
      return { kind: "failed", reason: "email-mismatch" };
    // The only other conflict: that sign-in is already linked to another account.
    case "conflict":
      return { kind: "failed", reason: "linked-elsewhere" };
    default:
      return { kind: "failed", reason: "unknown" };
  }
}
