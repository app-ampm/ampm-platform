import { Inject, Injectable } from "@nestjs/common";
import {
  errors,
  SIGN_IN_ERRORS,
  type Acknowledged,
  type ForgotPasswordRequest,
  type ResetPasswordRequest,
} from "@ampm/core";

import { AppLogger } from "../../common/logger.service.js";
import { PrismaService } from "../../db/prisma.service.js";
import { ENV, type Env } from "../../env.js";
import { AuthTokenService } from "../../identity/auth-token.service.js";
import { hashPassword } from "../../identity/password-hasher.js";
import { AuditService } from "../../policy/audit.service.js";
import { SessionService } from "../../policy/session.service.js";
import { NotificationService } from "../admin/notification/notification.service.js";
import { CredentialsRepository } from "./credentials.repository.js";

/**
 * A forgotten staff password (D-142): an emailed, single-use link valid for 60 minutes sets a new one.
 * - The request answers at once and the lookup and the email happen after it, so neither the answer nor
 *   its timing tells which emails have accounts.
 * - Only an active account with a confirmed authenticator gets a link: a password alone never opens an
 *   account, so one without an authenticator activates from an invitation instead.
 * - A reset signs out every session and cancels any sign-in already in progress, keeps the
 *   authenticator (the next sign-in still asks for its code) and never clears the code-failure count.
 */
@Injectable()
export class PasswordResetService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly credentials: CredentialsRepository,
    private readonly tokens: AuthTokenService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
    private readonly notifications: NotificationService,
    private readonly logger: AppLogger,
  ) {}

  /** Answers at once; an eligible account is emailed its link after the answer has gone. */
  async request(request: ForgotPasswordRequest): Promise<Acknowledged> {
    void this.sendLink(request.email).catch((error: unknown) =>
      this.logger.warn("auth.password_reset_request_failed", { error: String(error) }),
    );
    return { ok: true };
  }

  /** Emails a reset link to an active staff account with a confirmed authenticator, else nothing. */
  private async sendLink(email: string): Promise<void> {
    const user = await this.credentials.findStaffByEmail(email);
    if (user?.status === "active" && user.passwordHash && user.totpSecretEnc) {
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
  }

  /** Sets the new password with the link's token, then signs out every session of the account. */
  async reset(request: ResetPasswordRequest, now: Date = new Date()): Promise<Acknowledged> {
    const token = await this.tokens.findLiveSignInToken(request.token, "password_reset");
    const user = token ? await this.credentials.findById(token.userId) : null;
    const eligible = user?.userType === "staff" && user.status === "active" && user.totpSecretEnc;
    if (!token || !user || !eligible) {
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
      // A sign-in already past the old password must not finish after the reset.
      await this.tokens.retireSignInTokens(user.id, tx);
      await this.audit.record(
        { action: "update", entityType: "user", entityId: user.id, after: { password: "reset" } },
        tx,
      );
    });
    await this.sessions.revokeAllForUser(user.id, "password_reset", now);
    return { ok: true };
  }
}
