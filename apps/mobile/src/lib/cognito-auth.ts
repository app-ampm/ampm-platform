import {
  confirmSignIn,
  fetchAuthSession,
  fetchMFAPreference,
  setUpTOTP,
  signIn,
  signOut,
  updateMFAPreference,
  verifyTOTPSetup,
} from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";

/**
 * Staff Amazon Cognito sign-in: the ONLY module that imports `aws-amplify/auth` (api.md provider-SDK
 * isolation — the rest of the app sees these plain functions, never Amplify). Staff authenticate with
 * email + password over SRP (the password never crosses the wire) and an authenticator-app code (TOTP),
 * which the pool enforces as the preferred factor once enrolled. Client mobile+OTP sign-in is a separate
 * module (the deferred CUSTOM_AUTH path), not here.
 */

/** The issuer shown beside the staff member's code in their authenticator app. */
const TOTP_ISSUER = "AMPM";

/** What the sign-in UI must do next, mapped from Cognito's challenge. */
export type StaffAuthStep =
  { readonly kind: "done" } | { readonly kind: "totpCode" } | { readonly kind: "newPassword" };

function toStep(step: string): StaffAuthStep {
  switch (step) {
    case "DONE":
      return { kind: "done" };
    case "CONFIRM_SIGN_IN_WITH_TOTP_CODE":
      return { kind: "totpCode" };
    case "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED":
      return { kind: "newPassword" };
    default:
      throw new Error(`Unexpected staff sign-in step: ${step}`);
  }
}

/** Start a staff sign-in with email + password over SRP. */
export async function staffSignIn(email: string, password: string): Promise<StaffAuthStep> {
  const { nextStep } = await signIn({
    username: email.trim().toLowerCase(),
    password,
    options: { authFlowType: "USER_SRP_AUTH" },
  });
  return toStep(nextStep.signInStep);
}

/** Answer the current challenge: the 6-digit authenticator code, or a replacement for a temporary password. */
export async function submitStaffChallenge(answer: string): Promise<StaffAuthStep> {
  const { nextStep } = await confirmSignIn({ challengeResponse: answer });
  return toStep(nextStep.signInStep);
}

/** True when the signed-in staff member has not enrolled an authenticator yet (app-enforced for staff). */
export async function needsTotpEnrollment(): Promise<boolean> {
  const preference = await fetchMFAPreference();
  return preference.enabled?.includes("TOTP") !== true;
}

/** Begin authenticator enrolment: the shared secret and an `otpauth://` URI to render as a QR. */
export async function beginTotpEnrollment(
  email: string,
): Promise<{ readonly secret: string; readonly otpauthUri: string }> {
  const output = await setUpTOTP();
  return {
    secret: output.sharedSecret,
    otpauthUri: output.getSetupUri(TOTP_ISSUER, email.trim().toLowerCase()).toString(),
  };
}

/** Finish enrolment with the first code, then make TOTP the preferred factor (challenged every sign-in). */
export async function confirmTotpEnrollment(code: string): Promise<void> {
  await verifyTOTPSetup({ code });
  await updateMFAPreference({ totp: "PREFERRED" });
}

/** The current Cognito access token (Amplify refreshes it silently), or null when signed out. */
export async function getCognitoAccessToken(): Promise<string | null> {
  const session = await fetchAuthSession();
  return session.tokens?.accessToken?.toString() ?? null;
}

/** Sign out of Cognito, clearing the stored tokens. */
export async function cognitoSignOut(): Promise<void> {
  await signOut();
}

/** True when a Cognito session currently exists (a token is available or refreshable). */
export async function isCognitoSignedIn(): Promise<boolean> {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.accessToken !== undefined;
  } catch {
    return false;
  }
}

/** Subscribe to Cognito sign-in / sign-out / refresh-failure events; returns an unsubscribe. */
export function onCognitoAuthEvent(callback: () => void): () => void {
  return Hub.listen("auth", ({ payload }) => {
    if (
      payload.event === "signedIn" ||
      payload.event === "signedOut" ||
      payload.event === "tokenRefresh_failure"
    ) {
      callback();
    }
  });
}
