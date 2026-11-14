import { randomInt, randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import {
  errors,
  type DevCreateClientResponse,
  type DevLoginResponse,
  type DevOtpSendResponse,
} from "@ampm/core";

import { PrismaService } from "../db/prisma.service.js";
import { ENV, type Env } from "../env.js";
import { LocalIdentityAdapter } from "./local.adapter.js";

/** How long a demo code stays valid, and how many wrong tries burn it. */
const CODE_TTL_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;

interface PendingOtp {
  readonly code: string;
  readonly expiresAt: number;
  attempts: number;
}

interface DemoClient {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly identitySubject: string;
}

/**
 * Dev-only OTP sign-in — the demo stand-in until the real SMS/OTP provider is wired (SMS/OTP audit,
 * docs/engineering/sms-otp-provider-audit.md). A seeded, active client's mobile is exchanged for a
 * one-time code the API stores briefly AND returns, so the demo screen can show it — there is no SMS
 * yet. Fail-closed exactly like DevLoginService: refused unless IDENTITY_PROVIDER=local and NODE_ENV is
 * not production (env.ts already bars local in production), so a code is never generated or returned in
 * production. Pending codes live in memory — a single API process in dev (inline jobs, D-031) — so this
 * is dev/demo only. Not self-registration (A-13): the account must already exist and be active; verify
 * mints for its stored identity_subject, the key of the server-side session (D-033).
 */
@Injectable()
export class DevOtpService {
  // Keyed by the E.164 phone the request schema normalised to; verify normalises the same way.
  private readonly pending = new Map<string, PendingOtp>();

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
  ) {}

  async sendOtp(phone: string): Promise<DevOtpSendResponse> {
    this.assertDevOnly();
    // Denial equals absence (security.md): a number with no active client gets the same 404, no hint.
    await this.requireClient(phone);
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    this.pending.set(phone, { code, expiresAt: Date.now() + CODE_TTL_MS, attempts: 0 });
    // The code is never logged (no OTP in logs, security.md); it is returned for the on-screen demo only.
    return { demoCode: code, expiresInSeconds: Math.floor(CODE_TTL_MS / 1000) };
  }

  async verifyOtp(phone: string, code: string): Promise<DevLoginResponse> {
    this.assertDevOnly();
    const entry = this.pending.get(phone);
    if (!entry || entry.expiresAt < Date.now()) {
      this.pending.delete(phone);
      throw errors.unauthenticated("That code has expired — request a new one");
    }
    if (entry.attempts >= MAX_ATTEMPTS) {
      this.pending.delete(phone);
      throw errors.unauthenticated("Too many attempts — request a new code");
    }
    if (entry.code !== code) {
      entry.attempts += 1;
      throw errors.unauthenticated("That code is not correct");
    }
    this.pending.delete(phone);
    const client = await this.requireClient(phone);
    const secret = this.env.IDENTITY_LOCAL_SECRET;
    if (!secret) throw errors.notFound();
    const accessToken = await new LocalIdentityAdapter(secret).mint(client.identitySubject, {
      email: client.email,
    });
    return { accessToken, user: { id: client.id, name: client.name, email: client.email } };
  }

  /**
   * Create a brand-new active client (a prospect account + its contact user) so a demo can add a client
   * on the spot and then sign them in by mobile+OTP. Dev-only, the same gate as the OTP endpoints. The
   * account is an ordinary prospect, never is_demo, so its OWN subscription purchase opens every hotel —
   * the runtime twin of seedPortalDemoClient (apps/api/prisma/seed.ts). Refuses a mobile already in use,
   * so the later OTP lookup (requireClient) stays unambiguous.
   */
  async createClient(name: string, phone: string): Promise<DevCreateClientResponse> {
    this.assertDevOnly();
    const taken = await this.prisma.user.findFirst({
      where: { phone, userType: "client", status: "active", deletedAt: null },
      select: { id: true },
    });
    if (taken) throw errors.conflict("A client already uses that mobile number");
    const trimmed = name.trim();
    const subject = `local:demo-${randomUUID()}`;
    const email = `demo-${subject.slice(-12)}@example.com`;
    const user = await this.prisma.user.create({
      data: {
        userType: "client",
        status: "active",
        name: trimmed,
        email,
        phone,
        identitySubject: subject,
      },
      select: { id: true },
    });
    await this.createProspectAccount(user.id, trimmed, email);
    return { userId: user.id, phone };
  }

  /**
   * The prospect account AND — crucially — its `self` contact for the new demo client. The signed-in
   * client resolves its account through `account_contacts.user_id` (both the entitlement reads in
   * principal.repository.ts and the subscription purchase's `accountIdForUser`), NOT
   * `primary_contact_user_id` — so without this contact row the client sees no hotels and the ₹50k
   * purchase 404s. Mirrors seedPortalDemoClient (apps/api/prisma/seed.ts).
   */
  private async createProspectAccount(userId: string, name: string, email: string): Promise<void> {
    const account = await this.prisma.clientAccount.create({
      data: {
        name: `${name} (demo)`,
        status: "prospect",
        primaryContactUserId: userId,
        createdBy: userId,
      },
      select: { id: true },
    });
    await this.prisma.accountContact.create({
      data: {
        accountId: account.id,
        userId,
        name,
        relation: "self",
        email,
        isDecisionMaker: true,
        createdBy: userId,
      },
    });
  }

  private assertDevOnly(): void {
    const local = this.env.IDENTITY_PROVIDER === "local";
    if (!local || this.env.NODE_ENV === "production" || !this.env.IDENTITY_LOCAL_SECRET) {
      throw errors.notFound();
    }
  }

  private async requireClient(phone: string): Promise<DemoClient> {
    // phone is not unique (a soft-deleted row may share it): findFirst, never findUnique.
    const user = await this.prisma.user.findFirst({
      where: { phone, userType: "client", status: "active", deletedAt: null },
      select: { id: true, name: true, email: true, identitySubject: true },
    });
    if (!user?.identitySubject || !user.email) {
      throw errors.notFound();
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      identitySubject: user.identitySubject,
    };
  }
}
