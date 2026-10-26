import { errors } from "@ampm/core";
import { SignJWT, jwtVerify } from "jose";

import type { IdentityAdapter, VerifiedIdentity } from "./identity.types.js";

export const LOCAL_ISSUER = "ampm-local";

/**
 * Development and tests only (refused in production by env.ts): HS256 tokens with the same claims
 * a Cognito access token carries, minted by `pnpm --filter api dev:token`.
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
      return {
        subject: payload.sub,
        provider: "local",
        email: typeof payload.email === "string" ? payload.email : null,
        phone: typeof payload.phone_number === "string" ? payload.phone_number : null,
      };
    } catch {
      throw errors.unauthenticated();
    }
  }

  /** Mints a token for a subject; the seed's subjects are `local:<handle>`. */
  async mint(
    subject: string,
    options: { email?: string; expiresIn?: string } = {},
  ): Promise<string> {
    return new SignJWT({ token_use: "access", ...(options.email ? { email: options.email } : {}) })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(LOCAL_ISSUER)
      .setSubject(subject)
      .setIssuedAt()
      .setExpirationTime(options.expiresIn ?? "12h")
      .sign(this.key);
  }
}
