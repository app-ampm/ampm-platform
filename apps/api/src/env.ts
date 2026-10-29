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

const schema = fields.superRefine((value, ctx) => {
  for (const issue of [...identityIssues(value), ...deliveryIssues(value)]) {
    ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
  }
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: Readonly<Record<string, string | undefined>> = process.env): Env {
  return parseEnv(schema, source);
}

export const ENV = Symbol("ENV");
