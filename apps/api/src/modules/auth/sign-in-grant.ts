import { Inject, Injectable } from "@nestjs/common";
import { errors, SIGN_IN_ERRORS, type SignInGrant } from "@ampm/core";

import { requestContext } from "../../common/request-context.js";
import { SIGN_IN_KEYS, type SignInKeys } from "../../identity/sign-in-keys.js";
import { PrincipalService } from "../../policy/principal.service.js";
import { SessionService } from "../../policy/session.service.js";
import type { CredentialRecord } from "./credentials.repository.js";

/**
 * How long a staff access token lives. The server-side session (D-033) also ends after 12 hours idle
 * and on any revocation, so this is the ceiling, not the usual lifetime.
 */
export const STAFF_TOKEN_TTL = "12h";

/**
 * How long a client access token lives (D-147): the clients' idle window (`session.idle_timeouts`), so a
 * client is not asked for a paid SMS code every day. The server-side session still ends after its idle
 * timeout and on any revocation.
 */
export const CLIENT_TOKEN_TTL = "30d";

/** The token lifetimes a grant may carry. */
export type GrantTtl = typeof STAFF_TOKEN_TTL | typeof CLIENT_TOKEN_TTL;

/** The fields a grant needs: who the token is for, and the subject it carries. */
export type GrantUser = Pick<CredentialRecord, "id" | "name" | "email" | "identitySubject">;

/**
 * Completes a sign-in (D-142): mints the access token and opens its server-side session at once, the
 * same way AuthGuard opens one on a token's first use. Opening it now, not on first use, is what lets a
 * revocation between sign-in and the first request (a password reset, an administrator resetting the
 * authenticator) reach this token too: there is a session row to revoke. Called only after the password
 * and the authenticator code (or a recovery code) were both accepted.
 *
 *   return this.grants.grant(user); // { accessToken, user: { id, name, email } }
 */
@Injectable()
export class SignInGrants {
  constructor(
    @Inject(SIGN_IN_KEYS) private readonly keys: SignInKeys | null,
    private readonly principals: PrincipalService,
    private readonly sessions: SessionService,
  ) {}

  async grant(
    user: GrantUser,
    now: Date = new Date(),
    expiresIn: GrantTtl = STAFF_TOKEN_TTL,
  ): Promise<SignInGrant> {
    if (!this.keys) throw errors.notFound();
    if (!user.identitySubject) throw errors.unauthenticated(SIGN_IN_ERRORS.challengeExpired);
    const accessToken = await this.keys.tokens.mint(user.identitySubject, {
      email: user.email,
      expiresIn,
    });
    const verified = await this.keys.tokens.verifyAccessToken(accessToken);
    const principal = await this.principals.resolve(verified);
    // The session-create audit records the person who just signed in as its actor, as AuthGuard does.
    const store = requestContext.get();
    if (store) store.principal = principal;
    await this.sessions.touch(verified, principal, now);
    return { accessToken, user: { id: user.id, name: user.name, email: user.email } };
  }
}
