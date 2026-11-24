import { z } from "zod";

/** Whether an address is an origin alone: `https://site.example`, never `.../hotel-form?x#y`. */
function isOriginOnly(value: string): boolean {
  const url = new URL(value);
  return url.pathname === "/" && url.search === "" && url.hash === "";
}

/**
 * Every setting the API reads, with what it means. The rules that tie settings together (what
 * production refuses, what each provider requires) and the one read of `process.env` are in env.ts.
 */
export const fields = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3900),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  DATABASE_URL: z.string().url(),
  /**
   * Who signs people in. `ampm` is AMPM's own sign-in (D-142): staff password + authenticator code,
   * verified and minted by the API itself, and the default. `local` is the development provider (dev
   * sign-in, refused in production).
   */
  IDENTITY_PROVIDER: z.enum(["local", "ampm"]).default("ampm"),
  IDENTITY_LOCAL_SECRET: z.string().min(32).optional(),
  /** Signs the access tokens the `ampm` provider mints (HS256). Rotating it signs everyone out. */
  AUTH_TOKEN_SECRET: z.string().min(32).optional(),
  /**
   * Base64 of 32 random bytes: encrypts the staff authenticator secrets at rest (AES-256-GCM, `ampm`
   * provider). Changing it makes every enrolled authenticator unreadable, so it is never rotated casually.
   */
  AUTH_ENCRYPTION_KEY: z
    .string()
    .refine((value) => Buffer.from(value, "base64").length === 32, {
      message: "must be base64 of exactly 32 bytes (openssl rand -base64 32)",
    })
    .optional(),
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
  /**
   * The public website's origin (D-188 §6): a hotel information form link is
   * `<PUBLIC_SITE_URL>/hotel-form#k=<secret>`. The origin alone, with no path, query or fragment; a
   * trailing slash is dropped. Production refuses an address that is not https or names a local host.
   */
  PUBLIC_SITE_URL: z
    .string()
    .url()
    .default("http://localhost:3417")
    .transform((value) => value.replace(/\/+$/, ""))
    .refine(isOriginOnly, {
      message: "must be the website's origin alone, with no path, query or fragment",
    }),
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
  /**
   * SMS delivery (D-147): `console` logs only the channel and template (dev, test, and production until a
   * provider is wired); `2factor` or `msg91` sends through that DLT-registered provider.
   */
  SMS_PROVIDER: z.enum(["console", "2factor", "msg91"]).default("console"),
  /** The provider's API key (2Factor) or auth key (MSG91): a secret, set in the secret zone. */
  SMS_API_KEY: z.string().min(1).optional(),
  /** The DLT-approved sender ID (the six-letter header); 2Factor takes it on every message. */
  SMS_SENDER_ID: z.string().min(1).optional(),
  /**
   * The sign-in code's template (`auth.client_otp`) at the provider: its DLT content-template ID for
   * 2Factor, its own template ID (mapped to the DLT template in its panel) for MSG91.
   */
  SMS_OTP_TEMPLATE: z.string().min(1).optional(),
  /** The DLT principal-entity ID (PE ID); 2Factor takes it per message to skip a template sync delay. */
  SMS_DLT_ENTITY_ID: z.string().min(1).optional(),
  /**
   * TEMPORARY (D-147): also return each client sign-in code to the screen while SMS delivery is not live.
   * Anyone who knows a client's mobile can then sign in as that client, so it belongs behind the
   * pre-launch curtain only, the API warns at every boot while it is on, and turning it off is a go-live
   * blocker.
   */
  CLIENT_OTP_SCREEN_ECHO: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
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
  /**
   * The upload antivirus scan (AC-20.3; security.md: no file is downloadable before it passes). `stub`
   * flags only the EICAR test string: development, tests and CI, refused in production below (the C1
   * pattern). `clamav` streams each upload to clamd (the `clamav` Compose service) over TCP; no verdict
   * within CLAMAV_TIMEOUT_MS, or any error, stores nothing and answers 503 (fail closed).
   */
  AV_PROVIDER: z.enum(["stub", "clamav"]).default("stub"),
  CLAMAV_HOST: z.string().min(1).optional(),
  CLAMAV_PORT: z.coerce.number().int().min(1).max(65535).default(3310),
  CLAMAV_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
});

export type EnvFields = z.infer<typeof fields>;
