import { errors } from "@ampm/core";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

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
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly options: CognitoOptions) {
    this.issuer = `https://cognito-idp.${options.region}.amazonaws.com/${options.userPoolId}`;
    this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/.well-known/jwks.json`));
  }

  async verifyAccessToken(token: string): Promise<VerifiedIdentity> {
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, this.jwks, { issuer: this.issuer }));
    } catch {
      throw errors.unauthenticated();
    }
    return cognitoIdentityFromClaims(payload, this.options.clientId);
  }
}

/** The claim checks, separated so they can be tested without a key set. */
export function cognitoIdentityFromClaims(payload: JWTPayload, clientId: string): VerifiedIdentity {
  const claims = payload as JWTPayload & {
    token_use?: unknown;
    client_id?: unknown;
    email?: unknown;
    phone_number?: unknown;
  };
  if (claims.token_use !== "access") throw errors.unauthenticated();
  if (claims.client_id !== clientId) throw errors.unauthenticated();
  if (typeof claims.sub !== "string" || claims.sub.length === 0) throw errors.unauthenticated();
  if (typeof claims.jti !== "string" || claims.jti.length === 0) throw errors.unauthenticated();
  return {
    subject: claims.sub,
    provider: "cognito",
    tokenId: claims.jti,
    email: typeof claims.email === "string" ? claims.email : null,
    phone: typeof claims.phone_number === "string" ? claims.phone_number : null,
  };
}
