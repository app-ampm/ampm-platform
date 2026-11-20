import { StaffSignInScreen } from "./staff-sign-in-screen";
import { useStaffSignIn } from "./use-staff-sign-in";

/**
 * Staff sign-in against Amazon Cognito (`EXPO_PUBLIC_IDENTITY_PROVIDER=cognito`): email + password over
 * SRP, then the authenticator-app (TOTP) challenge or, on first sign-in, enrolment. Being retired by
 * D-142 in favour of AMPM's own sign-in (AmpmSignInScreen).
 */
export function CognitoSignInScreen() {
  return <StaffSignInScreen session={useStaffSignIn()} />;
}
