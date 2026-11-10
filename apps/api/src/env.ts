import { parseEnv } from "@ampm/core";
import { z } from "zod";

/** The API's configuration, read once here and nowhere else (code.md). */
const fields = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3900),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  DATABASE_URL: z.string().url(),
  IDENTITY_PROVIDER: z.enum(["cognito", "local"]).default("cognito"),
  IDENTITY_LOCAL_SECRET: z.string().min(32).optional(),
  COGNITO_REGION: z.string().min(1).optional(),
  COGNITO_USER_POOL_ID: z.string().min(1).optional(),
  COGNITO_CLIENT_ID: z.string().min(1).optional(),
  /**
   * Scoped admin IAM credentials for provisioning Cognito users at invite time (cognito-setup §6) — the
   * only AWS credentials the API holds; the verify path needs none. Optional: absent, provisioning uses the
   * default AWS provider chain (so a verify-only node boots), and a provisioning call then fails best-effort
   * and is logged, never fatal. The pair is all-or-nothing (below). Lives in the SOPS app zone, never code.
   */
  COGNITO_PROVISIONING_ACCESS_KEY_ID: z.string().min(1).optional(),
  COGNITO_PROVISIONING_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  /** The job queue's Redis; absent in development and tests, where jobs run inline (D-031). */
  REDIS_URL: z.string().url().optional(),
  /** `true` in the worker process only; the API process enqueues but does not consume (D-031). */
  JOB_WORKER: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  /**
   * Enables Super-Admin custom roles (D-036): the principal resolves `role_grants` into the engine's
   * `resolvedGrants`. Off by default until the admin surface and its tests are proven; while it is
   * off custom roles grant nothing, exactly as before, and come only from the seed.
   */
  DYNAMIC_ROLES: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  /** Browser origins allowed to call the API (the client portals' web build), comma-separated. */
  CORS_ORIGINS: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  /** Public web app base URL for links in notifications, e.g. the activation link (feature 5.2). */
  WEB_APP_URL: z.string().url().default("http://localhost:8082"),
  /** Email delivery: `console` logs only (dev/test); `smtp` sends via SES/SMTP (feature 5.3). */
  EMAIL_PROVIDER: z.enum(["smtp", "console"]).default("console"),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  /** The From address for outgoing email; set to a verified sender in staging/production. */
  EMAIL_FROM: z.string().min(1).default("AMPM <no-reply@localhost>"),
  /** Trusted proxy hops (Caddy) so `req.ip` is the real client for rate limits and audit; 0 trusts none. */
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  /**
   * The public-form bot check (C1, security.md). `stub` accepts any non-empty token — development and
   * staging only; production is refused below. `siteverify` posts the token to a provider's verify
   * endpoint (Cloudflare Turnstile / reCAPTCHA share the shape), with the URL and secret below.
   */
  BOT_CHECK_PROVIDER: z.enum(["stub", "siteverify"]).default("stub"),
  BOT_CHECK_URL: z.string().url().optional(),
  BOT_CHECK_SECRET: z.string().min(1).optional(),
  /**
   * The payment gateway (feature 8.3, AC-02). `stub` is a deterministic in-process sandbox for
   * development and staging — no network, no card data — refused in production below (the C1 pattern).
   * `razorpay` is the hosted-checkout gateway: `KEY_ID` is the public key the browser checkout uses,
   * `KEY_SECRET` signs the order API call, `WEBHOOK_SECRET` verifies the signed webhook. Keys come from
   * the secret zone (feature 6.4), never code.
   */
  PAYMENT_PROVIDER: z.enum(["stub", "razorpay"]).default("stub"),
  RAZORPAY_KEY_ID: z.string().min(1).optional(),
  RAZORPAY_KEY_SECRET: z.string().min(1).optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1).optional(),
  /**
   * Media object store (feature 9.3, AC-20). `local` writes under STORAGE_LOCAL_DIR and signs 15-minute
   * download URLs with MEDIA_SIGNING_SECRET (media's own key, security.md three-key rule) — development
   * and staging only; production is refused below (the C1 pattern). `s3` is the Mumbai bucket + CDN,
   * wired in feature 6.4.
   */
  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().min(1).default(".storage"),
  MEDIA_SIGNING_SECRET: z.string().min(32).optional(),
  /**
   * Allows `STORAGE_PROVIDER=local` in production for the single-VPS deployment where STORAGE_LOCAL_DIR is
   * a persistent, backed-up host volume (D-106; infra.md). Off by default so the local store is never
   * shipped to production by accident; when on, MEDIA_SIGNING_SECRET is required to sign download URLs. The
   * cloud path (`STORAGE_PROVIDER=s3`, feature 6.4) supersedes this when AMPM moves off the single box.
   */
  STORAGE_LOCAL_PERSISTENT: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

type EnvFields = z.infer<typeof fields>;
interface EnvIssue {
  readonly path: string[];
  readonly message: string;
}

/** Identity-provider consistency: local is refused in production; each provider's keys are required. */
function identityIssues(value: EnvFields): EnvIssue[] {
  const issues: EnvIssue[] = [];
  if (value.IDENTITY_PROVIDER === "local") {
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
      path: [hasKeyId ? "COGNITO_PROVISIONING_SECRET_ACCESS_KEY" : "COGNITO_PROVISIONING_ACCESS_KEY_ID"],
      message: "set both COGNITO_PROVISIONING_ACCESS_KEY_ID and COGNITO_PROVISIONING_SECRET_ACCESS_KEY, or neither",
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

const schema = fields.superRefine((value, ctx) => {
  for (const issue of [
    ...identityIssues(value),
    ...deliveryIssues(value),
    ...jobIssues(value),
    ...botCheckIssues(value),
    ...paymentIssues(value),
    ...storageIssues(value),
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
