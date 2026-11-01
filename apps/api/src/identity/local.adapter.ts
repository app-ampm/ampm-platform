import { randomUUID } from "node:crypto";

import { errors } from "@ampm/core";
import { SignJWT, jwtVerify } from "jose";

import type { IdentityAdapter, VerifiedIdentity } from "./identity.types.js";

export const LOCAL_ISSUER = "ampm-local";

/**
 * Development and tests only (refused in production by env.ts): HS256 tokens carrying the same shape
 * of claims as a Cognito access token (`sub`, `jti`, `email`), minted by `pnpm --filter api dev:token`.
 * A minted email is trusted as verified — there is no `email_verified` gate as in the Cognito adapter
 * (D-041), so that gate is covered by cognito.adapter.contract.spec.ts, not by the local e2e path.
 */
export class LocalIdentityAdapter implements IdentityAdapter {
  private readonly key: Uint8Array;

  constructor(secret: string) {
    this.key = new TextEncoder().encode(secret);
  }

  async verifyAccessToken(token: string): Promise<VerifiedIdentity> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: LOCAL_ISSUER,
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
        provider: "local",
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
      .setIssuer(LOCAL_ISSUER)
      .setSubject(subject)
      .setJti(options.jti ?? randomUUID())
      .setIssuedAt()
      .setExpirationTime(options.expiresIn ?? "12h")
      .sign(this.key);
  }
}
