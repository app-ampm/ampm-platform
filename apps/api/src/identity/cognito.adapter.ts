import { errors } from "@ampm/core";
import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";

import type { IdentityAdapter, VerifiedIdentity } from "./identity.types.js";

export interface CognitoOptions {
  readonly region: string;
  readonly userPoolId: string;
  readonly clientId: string;
}

/**
 * Amazon Cognito (Mumbai) access tokens (T-6): signature against the pool's JWKS, issuer, client
 * id and `token_use`. Everything else about the caller comes from the API's own users table.
 */
export class CognitoIdentityAdapter implements IdentityAdapter {
  private readonly issuer: string;
  private readonly jwks: JWTVerifyGetKey;

  /**
   * `jwks` defaults to the pool's remote key set; tests inject a local set (`createLocalJWKSet`) so the
   * adapter's real signature/issuer/expiry verification runs offline. Production always uses the default.
   */
  constructor(
    private readonly options: CognitoOptions,
    jwks?: JWTVerifyGetKey,
  ) {
    this.issuer = `https://cognito-idp.${options.region}.amazonaws.com/${options.userPoolId}`;
    this.jwks = jwks ?? createRemoteJWKSet(new URL(`${this.issuer}/.well-known/jwks.json`));
  }

  async verifyAccessToken(token: string): Promise<VerifiedIdentity> {
    let payload: JWTPayload;
    try {
      // Pin the algorithm the pool issues (RS256), mirroring the local adapter's HS256 pin, so an
      // unexpected-algorithm token is refused regardless of what a key set might offer.
      ({ payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        algorithms: ["RS256"],
      }));
    } catch {
      throw errors.unauthenticated();
    }
    return cognitoIdentityFromClaims(payload, this.options.clientId);
  }
}

/** A Cognito boolean claim is a JSON boolean, or the string "true" when a pre-token Lambda sets it. */
function isVerified(claim: unknown): boolean {
  return claim === true || claim === "true";
}

/** The claim checks, separated so they can be tested without a key set. */
export function cognitoIdentityFromClaims(payload: JWTPayload, clientId: string): VerifiedIdentity {
  const claims = payload as JWTPayload & {
    token_use?: unknown;
    client_id?: unknown;
    email?: unknown;
    email_verified?: unknown;
    phone_number?: unknown;
    phone_number_verified?: unknown;
  };
  if (claims.token_use !== "access") throw errors.unauthenticated();
  if (claims.client_id !== clientId) throw errors.unauthenticated();
  if (typeof claims.sub !== "string" || claims.sub.length === 0) throw errors.unauthenticated();
  if (typeof claims.jti !== "string" || claims.jti.length === 0) throw errors.unauthenticated();
  // Cognito access tokens always carry `exp`; require it so the session is kept only until the token
  // expires (A2). jwtVerify has already refused an expired token, so this is a present-and-numeric check.
  if (typeof claims.exp !== "number") throw errors.unauthenticated();
  // A contact is surfaced only when the provider marks it verified; otherwise it is treated as absent,
  // so activation's verified-email match (D-041) fails closed instead of trusting an unverified claim.
  return {
    subject: claims.sub,
    provider: "cognito",
    tokenId: claims.jti,
    expiresAt: new Date(claims.exp * 1000),
    email:
      typeof claims.email === "string" && isVerified(claims.email_verified) ? claims.email : null,
    phone:
      typeof claims.phone_number === "string" && isVerified(claims.phone_number_verified)
        ? claims.phone_number
        : null,
  };
}
