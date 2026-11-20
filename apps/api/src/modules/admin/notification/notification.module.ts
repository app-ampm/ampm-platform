import { Module } from "@nestjs/common";
import nodemailer from "nodemailer";

import { AppLogger } from "../../../common/logger.service.js";
import { ENV, type Env } from "../../../env.js";
import {
  ConsoleNotificationAdapter,
  NOTIFICATION_ADAPTERS,
  type NotificationAdapter,
  type NotificationAdapters,
} from "./notification.adapter.js";
import { NotificationController } from "./notification.controller.js";
import { NotificationRepository, PrismaNotificationRepository } from "./notification.repository.js";
import { NotificationService } from "./notification.service.js";
import { GatewaySmsAdapter } from "./gateway-sms.adapter.js";
import { smsTransportFor } from "./sms-transports.js";
import { SmtpEmailAdapter, type MailTransport } from "./smtp-email.adapter.js";

/** Builds the SMTP transport from env; isolates the nodemailer import to this composition root. */
function smtpTransport(env: Env): MailTransport {
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    // Require TLS when not using implicit TLS, so a stripped STARTTLS aborts rather than sending the
    // credentials and message in cleartext (security.md). Auth is set only when both parts are present
    // (env refuses a user without a password), never with an empty password.
    requireTLS: !env.SMTP_SECURE,
    ...(env.SMTP_USER && env.SMTP_PASSWORD
      ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } }
      : {}),
  });
  return {
    async sendMail(message) {
      const info = await transporter.sendMail(message);
      return { messageId: info.messageId };
    },
  };
}

/**
 * Email goes to the real SMTP adapter when configured, SMS to the configured DLT provider (D-147), and
 * either falls back to the console stub, as every other channel does.
 */
export function buildAdapters(env: Env, logger: AppLogger): NotificationAdapters {
  const stub = new ConsoleNotificationAdapter(logger);
  const email: NotificationAdapter =
    env.EMAIL_PROVIDER === "smtp"
      ? new SmtpEmailAdapter(smtpTransport(env), env.EMAIL_FROM, logger)
      : stub;
  const smsTransport = smsTransportFor(env);
  const sms: NotificationAdapter = smsTransport
    ? new GatewaySmsAdapter(smsTransport, logger)
    : stub;
  return {
    for: (channel) => {
      if (channel === "email") return email;
      return channel === "sms" ? sms : stub;
    },
  };
}

/**
 * Module A notifications: queue → persist → send job → the per-channel adapter registry; in-app is
 * delivered as a readable row, every external channel sits behind the provider-neutral adapter (the
 * console stub, with email on SES/SMTP once EMAIL_PROVIDER=smtp). JobsModule and ConfigModule are
 * global, so JobQueue and ConfigService are available here.
 */
@Module({
  controllers: [NotificationController],
  providers: [
    { provide: NotificationRepository, useClass: PrismaNotificationRepository },
    {
      provide: NOTIFICATION_ADAPTERS,
      useFactory: (env: Env, logger: AppLogger): NotificationAdapters => buildAdapters(env, logger),
      inject: [ENV, AppLogger],
    },
    NotificationService,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
