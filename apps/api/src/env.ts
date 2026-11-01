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

const schema = fields.superRefine((value, ctx) => {
  for (const issue of [
    ...identityIssues(value),
    ...deliveryIssues(value),
    ...jobIssues(value),
    ...botCheckIssues(value),
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
