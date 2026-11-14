import { Inject, Injectable } from "@nestjs/common";
import { errors, type DevLoginResponse } from "@ampm/core";

import { PrismaService } from "../db/prisma.service.js";
import { ENV, type Env } from "../env.js";
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
  ) {}

  async signIn(email: string): Promise<DevLoginResponse> {
    const secret = this.env.IDENTITY_LOCAL_SECRET;
    // Denial equals absence (security.md): outside a local, non-production config this does not exist.
    if (this.env.IDENTITY_PROVIDER !== "local" || this.env.NODE_ENV === "production" || !secret) {
      throw errors.notFound();
    }
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
    const secret = this.env.IDENTITY_LOCAL_SECRET;
    // Denial equals absence (security.md): outside a local, non-production config this does not exist.
    if (this.env.IDENTITY_PROVIDER !== "local" || this.env.NODE_ENV === "production" || !secret) {
      throw errors.notFound();
    }
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
}
