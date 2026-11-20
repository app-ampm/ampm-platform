import { randomUUID } from "node:crypto";

import { errors } from "@ampm/core";
import { SignJWT, jwtVerify } from "jose";

import type { IdentityAdapter, VerifiedIdentity } from "./identity.types.js";

export const LOCAL_ISSUER = "ampm-local";
/** The issuer of the tokens AMPM's own sign-in mints in production (D-142). */
export const AMPM_ISSUER = "ampm";

/** Which provider a token signer speaks for: the development one, or AMPM's own sign-in. */
export interface TokenSignerOptions {
  readonly issuer?: string;
  readonly provider?: "local" | "ampm";
}

/**
 * HS256 access tokens the API mints and verifies itself, with the same claims a Cognito access token
 * carries (`sub`, `jti`, `email`). Two uses: the development provider (issuer `ampm-local`, minted by
 * dev sign-in and `pnpm --filter api dev:token`, refused in production by env.ts), and AMPM's own
 * production sign-in (issuer `ampm`, minted only after a password and an authenticator code, D-142).
 * A minted email is trusted as verified: the API itself checked who the user is before minting.
 */
export class LocalIdentityAdapter implements IdentityAdapter {
  private readonly key: Uint8Array;
  private readonly issuer: string;
  private readonly provider: "local" | "ampm";

  constructor(secret: string, options: TokenSignerOptions = {}) {
    this.key = new TextEncoder().encode(secret);
    this.issuer = options.issuer ?? LOCAL_ISSUER;
    this.provider = options.provider ?? "local";
  }

  async verifyAccessToken(token: string): Promise<VerifiedIdentity> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: this.issuer,
        algorithms: ["HS256"],
      });
      if (payload.token_use !== "access" || typeof payload.sub !== "string")
        throw new Error("not an access token");
      if (typeof payload.jti !== "string") throw new Error("no token id");
      // A token with no expiry must not open a session: the reaper keeps a session until its token's
      // expiry, so a never-expiring token would mean a never-removable session (A2).
      if (typeof payload.exp !== "number") throw new Error("no token expiry");
      return {
        subject: payload.sub,
        provider: this.provider,
        tokenId: payload.jti,
        expiresAt: new Date(payload.exp * 1000),
        email: typeof payload.email === "string" ? payload.email : null,
        phone: typeof payload.phone_number === "string" ? payload.phone_number : null,
      };
    } catch {
      throw errors.unauthenticated();
    }
  }

  /** Mints a token for a subject; the seed's subjects are `local:<handle>`. A `jti` may be fixed for tests. */
  async mint(
    subject: string,
    options: { email?: string; expiresIn?: string; jti?: string } = {},
  ): Promise<string> {
    return new SignJWT({ token_use: "access", ...(options.email ? { email: options.email } : {}) })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(this.issuer)
      .setSubject(subject)
      .setJti(options.jti ?? randomUUID())
      .setIssuedAt()
      .setExpirationTime(options.expiresIn ?? "12h")
      .sign(this.key);
  }
}
