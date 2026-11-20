import { parseEnv } from "@ampm/core";
import { z } from "zod";

import { fields, type EnvFields } from "./env.fields.js";

// The API's configuration, read once here and nowhere else (code.md): the settings are declared in
// env.fields.ts, and the rules below hold them together (what production refuses, what each provider needs).

/** One broken rule, reported against the setting to fix. */
interface EnvIssue {
  readonly path: string[];
  readonly message: string;
}

/** Identity-provider consistency: local is refused in production; each provider's keys are required. */
function identityIssues(value: EnvFields): EnvIssue[] {
  if (value.IDENTITY_PROVIDER === "local") return localIdentityIssues(value);
  if (value.IDENTITY_PROVIDER === "ampm") return ampmIdentityIssues(value);
  return cognitoIdentityIssues(value);
}

function localIdentityIssues(value: EnvFields): EnvIssue[] {
  const issues: EnvIssue[] = [];
  if (value.NODE_ENV === "production") {
    issues.push({
      path: ["IDENTITY_PROVIDER"],
      message: "the local identity provider is refused in production",
    });
  }
  if (!value.IDENTITY_LOCAL_SECRET) {
    issues.push({
      path: ["IDENTITY_LOCAL_SECRET"],
      message: "required with the local identity provider",
    });
  }
  return issues;
}

/** AMPM's own sign-in (D-142) needs its token-signing secret and its encryption key, in every environment. */
function ampmIdentityIssues(value: EnvFields): EnvIssue[] {
  const issues: EnvIssue[] = [];
  for (const key of ["AUTH_TOKEN_SECRET", "AUTH_ENCRYPTION_KEY"] as const) {
    if (!value[key])
      issues.push({ path: [key], message: "required with the ampm identity provider" });
  }
  return issues;
}

function cognitoIdentityIssues(value: EnvFields): EnvIssue[] {
  const issues: EnvIssue[] = [];
  for (const key of ["COGNITO_REGION", "COGNITO_USER_POOL_ID", "COGNITO_CLIENT_ID"] as const) {
    if (!value[key]) {
      issues.push({ path: [key], message: "required with the Cognito identity provider" });
    }
  }
  // Provisioning credentials are optional, but a half-set pair is a misconfiguration: one key without the
  // other silently falls back to the default AWS chain and looks like working provisioning that isn't.
  const hasKeyId = Boolean(value.COGNITO_PROVISIONING_ACCESS_KEY_ID);
  const hasSecret = Boolean(value.COGNITO_PROVISIONING_SECRET_ACCESS_KEY);
  if (hasKeyId !== hasSecret) {
    issues.push({
      path: [
        hasKeyId ? "COGNITO_PROVISIONING_SECRET_ACCESS_KEY" : "COGNITO_PROVISIONING_ACCESS_KEY_ID",
      ],
      message:
        "set both COGNITO_PROVISIONING_ACCESS_KEY_ID and COGNITO_PROVISIONING_SECRET_ACCESS_KEY, or neither",
    });
  }
  return issues;
}

/** Notification delivery: a usable web URL for links, and real SMTP in production (features 5.2/5.3). */
function deliveryIssues(value: EnvFields): EnvIssue[] {
  const issues: EnvIssue[] = [];
  if (value.NODE_ENV === "production" && /\/\/(localhost|127\.0\.0\.1)/.test(value.WEB_APP_URL)) {
    issues.push({
      path: ["WEB_APP_URL"],
      message: "a non-localhost WEB_APP_URL is required in production (invite links point to it)",
    });
  }
  if (value.EMAIL_PROVIDER === "smtp" && !value.SMTP_HOST) {
    issues.push({ path: ["SMTP_HOST"], message: "required when EMAIL_PROVIDER is smtp" });
  }
  if (value.SMTP_USER && !value.SMTP_PASSWORD) {
    issues.push({ path: ["SMTP_PASSWORD"], message: "required when SMTP_USER is set" });
  }
  if (value.NODE_ENV === "production" && value.EMAIL_PROVIDER !== "smtp") {
    issues.push({
      path: ["EMAIL_PROVIDER"],
      message: "must be smtp in production (invitations are emailed)",
    });
  }
  if (value.NODE_ENV === "production" && /@localhost/.test(value.EMAIL_FROM)) {
    issues.push({
      path: ["EMAIL_FROM"],
      message: "a verified non-localhost sender is required in production",
    });
  }
  return issues;
}

/**
 * SMS (D-147): a provider needs its key and the sign-in code's DLT template. In production the console
 * stub is allowed only while the code is also shown on screen, since otherwise no client could ever
 * receive one.
 */
function smsIssues(value: EnvFields): EnvIssue[] {
  const needed = {
    console: [],
    msg91: ["SMS_API_KEY", "SMS_OTP_TEMPLATE"],
    "2factor": ["SMS_API_KEY", "SMS_OTP_TEMPLATE", "SMS_SENDER_ID"],
  } as const;
  const issues: EnvIssue[] = needed[value.SMS_PROVIDER]
    .filter((key) => !value[key])
    .map((key) => ({
      path: [key],
      message: `required when SMS_PROVIDER is ${value.SMS_PROVIDER}`,
    }));
  if (
    value.NODE_ENV === "production" &&
    value.SMS_PROVIDER === "console" &&
    !value.CLIENT_OTP_SCREEN_ECHO
  ) {
    issues.push({
      path: ["SMS_PROVIDER"],
      message:
        "no client could receive a sign-in code: set an SMS provider, or CLIENT_OTP_SCREEN_ECHO=true " +
        "while production is behind the pre-launch curtain (D-147)",
    });
  }
  return issues;
}

/**
 * Jobs: production must have `REDIS_URL` (A6). Without it the inline driver runs jobs in the request,
 * the scheduled jobs (session reaper, demo restore, follow-up reminder) never run, and the rate limiter
 * is per-process in memory, none of which is safe for a real deployment (D-031).
 */
function jobIssues(value: EnvFields): EnvIssue[] {
  if (value.NODE_ENV === "production" && !value.REDIS_URL) {
    return [
      {
        path: ["REDIS_URL"],
        message:
          "required in production: without it jobs run inline, the scheduled jobs (session reaper, " +
          "demo restore, follow-up reminder) never run, and the rate limiter is per-process",
      },
    ];
  }
  return [];
}

/**
 * Bot check: production must use a real provider, not the accept-anything stub (C1); the siteverify
 * provider needs its verify URL and secret. Without this guard a no-op bot check ships to production.
 */
function botCheckIssues(value: EnvFields): EnvIssue[] {
  const issues: EnvIssue[] = [];
  if (value.NODE_ENV === "production" && value.BOT_CHECK_PROVIDER === "stub") {
    issues.push({
      path: ["BOT_CHECK_PROVIDER"],
      message: "the stub bot check (accepts any token) is refused in production; use siteverify",
    });
  }
  if (value.BOT_CHECK_PROVIDER === "siteverify") {
    if (!value.BOT_CHECK_URL) {
      issues.push({
        path: ["BOT_CHECK_URL"],
        message: "required when BOT_CHECK_PROVIDER is siteverify",
      });
    }
    if (!value.BOT_CHECK_SECRET) {
      issues.push({
        path: ["BOT_CHECK_SECRET"],
        message: "required when BOT_CHECK_PROVIDER is siteverify",
      });
    }
  }
  return issues;
}

/**
 * Payments: production must use a real gateway, not the in-process stub (the C1 pattern); the Razorpay
 * gateway needs its public key, secret and webhook secret. Without this guard a no-op payment adapter
 * that activates nothing could ship to production.
 */
function paymentIssues(value: EnvFields): EnvIssue[] {
  const issues: EnvIssue[] = [];
  if (value.NODE_ENV === "production" && value.PAYMENT_PROVIDER === "stub") {
    issues.push({
      path: ["PAYMENT_PROVIDER"],
      message: "the stub payment gateway is refused in production; use razorpay",
    });
  }
  if (value.PAYMENT_PROVIDER === "razorpay") {
    for (const key of [
      "RAZORPAY_KEY_ID",
      "RAZORPAY_KEY_SECRET",
      "RAZORPAY_WEBHOOK_SECRET",
    ] as const) {
      if (!value[key]) {
        issues.push({ path: [key], message: "required when PAYMENT_PROVIDER is razorpay" });
      }
    }
  }
  return issues;
}

/** Behind Caddy in production, `req.ip` must be the real client, so an untrusted proxy is refused. */
function proxyIssues(value: EnvFields): EnvIssue[] {
  if (value.NODE_ENV === "production" && value.TRUST_PROXY === 0) {
    return [
      {
        path: ["TRUST_PROXY"],
        message:
          "a proxy hop count is required in production: the API runs behind Caddy, and 0 keys every " +
          "rate limit and audit event to the proxy's address instead of the client's",
      },
    ];
  }
  return [];
}

/**
 * Media store in production. The S3 bucket + CDN (feature 6.4) is the default. The local filesystem store
 * is also allowed, but only for the single-VPS deployment and only deliberately: STORAGE_LOCAL_PERSISTENT
 * must confirm STORAGE_LOCAL_DIR is a persistent, backed-up host volume (D-106, infra.md), and
 * MEDIA_SIGNING_SECRET must be set so the 15-minute download URLs are signed. Without the opt-in the local
 * store stays refused in production, so it is never shipped there by accident.
 */
function storageIssues(value: EnvFields): EnvIssue[] {
  if (value.NODE_ENV !== "production" || value.STORAGE_PROVIDER !== "local") return [];
  if (!value.STORAGE_LOCAL_PERSISTENT) {
    return [
      {
        path: ["STORAGE_PROVIDER"],
        message:
          "the local filesystem media store is refused in production unless STORAGE_LOCAL_PERSISTENT=true " +
          "confirms STORAGE_LOCAL_DIR is a persistent, backed-up volume (single-VPS deployment, D-106); " +
          "otherwise serve media from the S3 bucket and CDN (feature 6.4)",
      },
    ];
  }
  if (!value.MEDIA_SIGNING_SECRET) {
    return [
      {
        path: ["MEDIA_SIGNING_SECRET"],
        message:
          "required with the local media store in production: it signs the 15-minute download URLs",
      },
    ];
  }
  return [];
}

/**
 * Upload antivirus: production must scan with ClamAV, not the stub that flags only the EICAR test file
 * (the C1 pattern), and the clamav provider needs the daemon's host.
 */
function antivirusIssues(value: EnvFields): EnvIssue[] {
  if (value.AV_PROVIDER === "clamav" && !value.CLAMAV_HOST) {
    return [{ path: ["CLAMAV_HOST"], message: "required when AV_PROVIDER is clamav" }];
  }
  if (value.NODE_ENV === "production" && value.AV_PROVIDER === "stub") {
    return [
      {
        path: ["AV_PROVIDER"],
        message:
          "the stub antivirus scanner (it flags only the EICAR test file) is refused in production; " +
          "use clamav",
      },
    ];
  }
  return [];
}

const schema = fields.superRefine((value, ctx) => {
  for (const issue of [
    ...identityIssues(value),
    ...deliveryIssues(value),
    ...smsIssues(value),
    ...jobIssues(value),
    ...botCheckIssues(value),
    ...paymentIssues(value),
    ...storageIssues(value),
    ...antivirusIssues(value),
    ...proxyIssues(value),
  ]) {
    ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
  }
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: Readonly<Record<string, string | undefined>> = process.env): Env {
  return parseEnv(schema, source);
}

export const ENV = Symbol("ENV");
