/** What an identity adapter proves about a caller: who they are at the identity service, nothing more. */
export interface VerifiedIdentity {
  /** The provider's stable subject (`sub`), stored on `users.identity_subject`. */
  readonly subject: string;
  readonly provider: "cognito" | "local";
  /** The access token's `jti`; the key of the server-side session (D-033). */
  readonly tokenId: string;
  /** The access token's expiry (`exp`); the session row is kept until then so revocation holds (A2). */
  readonly expiresAt: Date;
  readonly email: string | null;
  readonly phone: string | null;
}

export interface IdentityAdapter {
  /** Verifies an access token's signature, issuer, audience, expiry and use; throws `unauthenticated` otherwise. */
  verifyAccessToken(token: string): Promise<VerifiedIdentity>;
}

export const IDENTITY_ADAPTER = Symbol("IDENTITY_ADAPTER");

/** What the admin control plane provisions at the identity service when a user is invited (cognito-setup §6). */
export interface ProvisionUserInput {
  /** Staff sign in by email + password; clients by phone + OTP. Decides the username and stamped contacts. */
  readonly kind: "staff" | "client";
  /** Stamped verified; for a client it MUST equal `users.email` exactly (activation matches email, D-041). */
  readonly email: string;
  /** E.164. A client's sign-in handle, so provisioning one needs it; unused for staff. */
  readonly phone: string | null;
}

/**
 * The control-plane counterpart to {@link IdentityAdapter}: creates a sign-in account for an invited user
 * so they can obtain a token and activate. The provider subject is NOT returned — it is bound later at
 * activation (D-041). Implementations are idempotent and run best-effort after the AMPM user commits, so a
 * provisioning failure never fails an invite (it is logged and recovered by reinvite). Local is a no-op.
 */
export interface IdentityProvisioner {
  provisionUser(input: ProvisionUserInput): Promise<void>;
}

export const IDENTITY_PROVISIONER = Symbol("IDENTITY_PROVISIONER");
