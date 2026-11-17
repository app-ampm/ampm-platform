import { Inject, Injectable } from "@nestjs/common";
import { ACTIVATION_ERRORS, errors, type DevLoginResponse } from "@ampm/core";

import { PrismaService } from "../db/prisma.service.js";
import { ENV, type Env } from "../env.js";
import { AuthTokenService } from "./auth-token.service.js";
import { assertDevBuild } from "./dev-gate.js";
import { LocalIdentityAdapter } from "./local.adapter.js";

/**
 * Development sign-in (features TW-11 + CP-11 demo). Exchanges a seeded, active staff or client user's
 * email for a freshly minted local access token, so the Sales workspace and the client portal sign in
 * against the real API without Cognito.
 *
 * Fail-closed: refused unless the local identity provider is active AND NODE_ENV is not production (and
 * the local secret is set). `env.ts` already refuses `IDENTITY_PROVIDER=local` in production, so there
 * is no production path; this is the request-time gate. Not self-registration (A-13) — it only mints a
 * token for an account that already exists and is active. It mints for the user's STORED
 * `identity_subject` so the AuthGuard resolves the same account on the next request.
 */
@Injectable()
export class DevLoginService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly tokens: AuthTokenService,
  ) {}

  /**
   * The local signing secret, or a 404 outside a local, non-production config: denial equals absence
   * (security.md), so there these endpoints do not exist.
   */
  private localSecret(): string {
    return assertDevBuild(this.env);
  }

  async signIn(email: string): Promise<DevLoginResponse> {
    const secret = this.localSecret();
    // email is not unique (a soft-deleted row may share it): findFirst, never findUnique.
    // Staff sign into the Sales workspace; an active client signs into the portal (both dev-only).
    const user = await this.prisma.user.findFirst({
      where: { email, userType: { in: ["staff", "client"] }, status: "active", deletedAt: null },
      select: { id: true, name: true, email: true, identitySubject: true },
    });
    if (!user?.identitySubject) {
      throw errors.unauthenticated("No local sign-in for that email");
    }
    const accessToken = await new LocalIdentityAdapter(secret).mint(user.identitySubject, {
      email: user.email,
    });
    return { accessToken, user: { id: user.id, name: user.name, email: user.email } };
  }

  /**
   * Dev-only demo sign-in (P-7): mints a local session for the seeded demo prospect so the demo
   * experience — a curated set of hotels with indicative prices — can be entered without the real
   * mobile/OTP transport (still Cognito-pending). There is no identifier to supply: there is one demo
   * prospect, resolved by `user_type = "demo"` rather than widening the email/mobile sign-in to demo
   * accounts. Same fail-closed gate as `signIn`, so there is no production path, and it mints for the
   * demo account's STORED identity_subject (the session key, D-033), which a future Cognito link
   * replaces without touching this path.
   */
  async signInDemo(): Promise<DevLoginResponse> {
    const secret = this.localSecret();
    const user = await this.prisma.user.findFirst({
      where: { userType: "demo", status: "active", deletedAt: null },
      select: { id: true, name: true, email: true, identitySubject: true },
    });
    if (!user?.identitySubject || !user.email) {
      throw errors.unauthenticated("No demo account is available");
    }
    const accessToken = await new LocalIdentityAdapter(secret).mint(user.identitySubject, {
      email: user.email,
    });
    return { accessToken, user: { id: user.id, name: user.name, email: user.email } };
  }

  /**
   * The local stand-in for the provider sign-in that comes before activation (D-041). Under Cognito an
   * invitee signs in to the pool and presents that access token to `/auth/activate`; the local provider
   * has no pool, so this mints a local access token for the invitation's account — a subject of its own
   * (`local:<user id>`, unique like the column it will fill) carrying the invited email — for the
   * activation screen to present to `/auth/activate` exactly as it would a Cognito token. It activates
   * nothing: the invitation is checked here, not claimed, and the real activation still links the
   * subject, claims the invitation once and audits. Same fail-closed gate as `signIn`, so there is no
   * production path, and not self-registration (A-13): without a live invitation there is no token.
   */
  async signInForInvite(inviteToken: string): Promise<DevLoginResponse> {
    const secret = this.localSecret();
    const invite = await this.tokens.findValidInvite(inviteToken);
    if (!invite) throw errors.unauthenticated(ACTIVATION_ERRORS.invalidInvite);
    const user = await this.prisma.user.findFirst({
      where: { id: invite.userId, deletedAt: null },
      select: { id: true, name: true, email: true, status: true },
    });
    if (!user) throw errors.unauthenticated(ACTIVATION_ERRORS.invalidInvite);
    // The same refusal activation gives, so the screen says "already active" before it tries.
    if (user.status !== "invited") throw errors.conflict(ACTIVATION_ERRORS.alreadyActive);
    const accessToken = await new LocalIdentityAdapter(secret).mint(`local:${user.id}`, {
      email: user.email,
    });
    return { accessToken, user: { id: user.id, name: user.name, email: user.email } };
  }
}
