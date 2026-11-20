import { Inject, Injectable } from "@nestjs/common";
import {
  errors,
  SIGN_IN_ERRORS,
  type Acknowledged,
  type ForgotPasswordRequest,
  type ResetPasswordRequest,
} from "@ampm/core";

import { PrismaService } from "../../db/prisma.service.js";
import { ENV, type Env } from "../../env.js";
import { AuthTokenService } from "../../identity/auth-token.service.js";
import { hashPassword } from "../../identity/password-hasher.js";
import { SIGN_IN_KEYS, type SignInKeys } from "../../identity/sign-in-keys.js";
import { AuditService } from "../../policy/audit.service.js";
import { SessionService } from "../../policy/session.service.js";
import { NotificationService } from "../admin/notification/notification.service.js";
import { CredentialsRepository } from "./credentials.repository.js";

/**
 * A forgotten staff password (D-142): an emailed, single-use link valid for 60 minutes sets a new one.
 * The request always answers the same, whether or not the email has an account. A reset clears the
 * lockout, signs out every session and leaves the authenticator as it was: the next sign-in still asks
 * for its code.
 */
@Injectable()
export class PasswordResetService {
  constructor(
    @Inject(SIGN_IN_KEYS) private readonly keys: SignInKeys | null,
    @Inject(ENV) private readonly env: Env,
    private readonly credentials: CredentialsRepository,
    private readonly tokens: AuthTokenService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
    private readonly notifications: NotificationService,
  ) {}

  /** Emails a reset link to an active staff account with this email; the same answer either way. */
  async request(request: ForgotPasswordRequest): Promise<Acknowledged> {
    this.signer();
    const user = await this.credentials.findStaffByEmail(request.email);
    if (user?.status === "active") {
      const raw = await this.tokens.issueSignInToken(user.id, "password_reset");
      await this.notifications.queue({
        recipientType: "user",
        recipientId: user.id,
        channel: "email",
        eventType: "auth.password_reset",
        templateKey: "auth.password_reset",
        entityType: "user",
        entityId: user.id,
        variables: {
          name: user.name,
          resetUrl: `${this.env.WEB_APP_URL}/reset-password?token=${encodeURIComponent(raw)}`,
        },
      });
    }
    return { ok: true };
  }

  /** Sets the new password with the link's token, then signs out every session of the account. */
  async reset(request: ResetPasswordRequest, now: Date = new Date()): Promise<Acknowledged> {
    this.signer();
    const token = await this.tokens.findLiveSignInToken(request.token, "password_reset");
    const user = token ? await this.credentials.findById(token.userId) : null;
    if (!token || !user || user.userType !== "staff" || user.status !== "active") {
      throw errors.unauthenticated(SIGN_IN_ERRORS.invalidResetLink);
    }
    if (request.password.trim().toLowerCase() === user.email.toLowerCase()) {
      const message = "Choose a password that is not your email address";
      throw errors.validation([{ path: "password", message }], message);
    }
    const passwordHash = await hashPassword(request.password);
    await this.prisma.$transaction(async (tx) => {
      if (!(await this.tokens.markUsedIfLive(token.id, tx))) {
        throw errors.unauthenticated(SIGN_IN_ERRORS.invalidResetLink);
      }
      await this.credentials.savePassword(user.id, passwordHash, now, tx);
      await this.audit.record(
        { action: "update", entityType: "user", entityId: user.id, after: { password: "reset" } },
        tx,
      );
    });
    await this.sessions.revokeAllForUser(user.id, "password_reset", now);
    return { ok: true };
  }

  private signer(): SignInKeys {
    if (!this.keys) throw errors.notFound();
    return this.keys;
  }
}
