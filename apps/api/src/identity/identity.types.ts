/** What an identity adapter proves about a caller: who they are at the identity service, nothing more. */
export interface VerifiedIdentity {
  /** The provider's stable subject (`sub`), stored on `users.identity_subject`. */
  readonly subject: string;
  readonly provider: "cognito" | "local";
  readonly email: string | null;
  readonly phone: string | null;
}

export interface IdentityAdapter {
  /** Verifies an access token's signature, issuer, audience, expiry and use; throws `unauthenticated` otherwise. */
  verifyAccessToken(token: string): Promise<VerifiedIdentity>;
}

export const IDENTITY_ADAPTER = Symbol("IDENTITY_ADAPTER");
