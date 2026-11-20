/**
 * The step the staff sign-in screen shows (AMPM's own sign-in, D-142): the email and password, then the
 * authenticator code or, in its place, one of the recovery codes. An account without an authenticator
 * adds one when it activates from its invitation, never here.
 */
export type Phase =
  | { readonly kind: "credentials" }
  | { readonly kind: "totpCode" }
  | { readonly kind: "recoveryCode" };

/** What a sign-in hook gives the screen: the phase, its state, and the actions that move it on. */
export interface StaffSignIn {
  readonly phase: Phase;
  readonly pending: boolean;
  readonly error: string | undefined;
  readonly email: string;
  readonly setEmail: (value: string) => void;
  readonly signIn: (password: string) => void;
  /** The 6-digit authenticator code. */
  readonly submitChallenge: (code: string) => void;
  /** Switch between the authenticator code and a recovery code. */
  readonly toggleRecoveryCode: () => void;
  readonly submitRecoveryCode: (code: string) => void;
}
