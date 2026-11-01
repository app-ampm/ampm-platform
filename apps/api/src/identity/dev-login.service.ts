import { Inject, Injectable } from "@nestjs/common";
import { errors, type DevLoginResponse } from "@ampm/core";

import { PrismaService } from "../db/prisma.service.js";
import { ENV, type Env } from "../env.js";
import { LocalIdentityAdapter } from "./local.adapter.js";

/**
 * Development sign-in (feature TW-11 demo). Exchanges a seeded, active staff user's email for a freshly
 * minted local access token, so the Sales workspace signs in against the real API without Cognito.
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
    const user = await this.prisma.user.findFirst({
      where: { email, userType: "staff", status: "active", deletedAt: null },
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
}
