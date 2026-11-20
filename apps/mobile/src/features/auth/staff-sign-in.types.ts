/**
 * The step the staff sign-in screen shows, whoever signs people in: AMPM's own sign-in (D-142) or
 * Amazon Cognito. `recoveryCode` and `recoveryCodes` exist only with AMPM's own sign-in.
 */
export type Phase =
  | { readonly kind: "credentials" }
  | { readonly kind: "totpCode" }
  | { readonly kind: "recoveryCode" }
  | { readonly kind: "newPassword" }
  | { readonly kind: "enrollTotp"; readonly secret: string; readonly otpauthUri: string }
  | { readonly kind: "recoveryCodes"; readonly codes: readonly string[] };

/** What a sign-in hook gives the screen: the phase, its state, and the actions that move it on. */
export interface StaffSignIn {
  readonly phase: Phase;
  readonly pending: boolean;
  readonly error: string | undefined;
  readonly email: string;
  readonly setEmail: (value: string) => void;
  readonly signIn: (password: string) => void;
  readonly submitChallenge: (answer: string) => void;
  readonly confirmEnrollment: (code: string) => void;
  /** Switch between the authenticator code and a recovery code (AMPM's own sign-in only). */
  readonly toggleRecoveryCode?: () => void;
  readonly submitRecoveryCode?: (code: string) => void;
  /** Leave the recovery-codes step once they are saved, into the app (AMPM's own sign-in only). */
  readonly finish?: () => void;
}
