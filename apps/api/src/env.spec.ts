import { describe, expect, it } from "vitest";

import { loadEnv } from "./env.js";

/** A production config on the default identity provider, AMPM's own sign-in (D-142). */
const prodValid = {
  NODE_ENV: "production",
  DATABASE_URL: "postgres://localhost:5432/ampm",
  // Built at run time so no secret-looking literal sits in the repository.
  AUTH_TOKEN_SECRET: "t".repeat(40),
  AUTH_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  EMAIL_PROVIDER: "smtp",
  SMTP_HOST: "smtp.example.com",
  EMAIL_FROM: "AMPM <no-reply@ampm.example>",
  WEB_APP_URL: "https://app.ampm.example",
  TRUST_PROXY: "1",
  REDIS_URL: "redis://redis:6379",
  BOT_CHECK_PROVIDER: "siteverify",
  BOT_CHECK_URL: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
  BOT_CHECK_SECRET: "bot-secret",
  PAYMENT_PROVIDER: "razorpay",
  RAZORPAY_KEY_ID: "rzp_test_key",
  RAZORPAY_KEY_SECRET: "rzp-key-secret",
  RAZORPAY_WEBHOOK_SECRET: "rzp-webhook-secret",
  STORAGE_PROVIDER: "s3",
  SMS_PROVIDER: "2factor",
  SMS_API_KEY: "sms-api-key",
  SMS_OTP_TEMPLATE: "1707000000000000001",
  SMS_SENDER_ID: "AMPMVS",
  AV_PROVIDER: "clamav",
  CLAMAV_HOST: "clamav",
};

describe("loadEnv", () => {
  it("accepts a development config on the defaults (console email)", () => {
    const env = loadEnv({
      DATABASE_URL: "postgres://localhost:5432/ampm",
      IDENTITY_PROVIDER: "local",
      IDENTITY_LOCAL_SECRET: "a-development-secret-that-is-32chars",
    });
    expect(env.EMAIL_PROVIDER).toBe("console");
  });

  it("accepts a valid production config", () => {
    expect(loadEnv(prodValid).EMAIL_PROVIDER).toBe("smtp");
  });

  it("requires SMTP_HOST when EMAIL_PROVIDER is smtp", () => {
    const { SMTP_HOST: _omit, ...withoutHost } = prodValid;
    expect(() => loadEnv(withoutHost)).toThrow(/SMTP_HOST/);
  });

  it("requires SMTP_PASSWORD when SMTP_USER is set", () => {
    expect(() => loadEnv({ ...prodValid, SMTP_USER: "ses-user" })).toThrow(/SMTP_PASSWORD/);
  });

  it("refuses console email in production", () => {
    expect(() => loadEnv({ ...prodValid, EMAIL_PROVIDER: "console" })).toThrow(
      /smtp in production/,
    );
  });

  it("refuses a localhost sender in production", () => {
    expect(() => loadEnv({ ...prodValid, EMAIL_FROM: "AMPM <no-reply@localhost>" })).toThrow(
      /EMAIL_FROM/,
    );
  });

  it("refuses the local media store in production by default", () => {
    expect(() => loadEnv({ ...prodValid, STORAGE_PROVIDER: "local" })).toThrow(/STORAGE_PROVIDER/);
  });

  it("allows the local media store in production when it is a persistent, signed volume (D-106)", () => {
    const env = loadEnv({
      ...prodValid,
      STORAGE_PROVIDER: "local",
      STORAGE_LOCAL_PERSISTENT: "true",
      MEDIA_SIGNING_SECRET: "a-production-media-signing-secret-key",
    });
    expect(env.STORAGE_PROVIDER).toBe("local");
    expect(env.STORAGE_LOCAL_PERSISTENT).toBe(true);
  });

  it("requires MEDIA_SIGNING_SECRET for the local media store in production", () => {
    expect(() =>
      loadEnv({ ...prodValid, STORAGE_PROVIDER: "local", STORAGE_LOCAL_PERSISTENT: "true" }),
    ).toThrow(/MEDIA_SIGNING_SECRET/);
  });

  it("refuses a localhost WEB_APP_URL in production", () => {
    expect(() => loadEnv({ ...prodValid, WEB_APP_URL: "http://localhost:8082" })).toThrow(
      /WEB_APP_URL/,
    );
  });

  it("refuses an untrusted proxy in production", () => {
    const { TRUST_PROXY: _omit, ...withoutProxy } = prodValid;
    expect(() => loadEnv(withoutProxy)).toThrow(/TRUST_PROXY/);
  });

  it("refuses the local identity provider in production", () => {
    expect(() =>
      loadEnv({
        ...prodValid,
        IDENTITY_PROVIDER: "local",
        IDENTITY_LOCAL_SECRET: "a-development-secret-that-is-32chars",
      }),
    ).toThrow(/local identity provider/);
  });

  it("requires REDIS_URL in production (A6)", () => {
    const { REDIS_URL: _omit, ...withoutRedis } = prodValid;
    expect(() => loadEnv(withoutRedis)).toThrow(/REDIS_URL/);
  });

  it("allows development without REDIS_URL (jobs run inline)", () => {
    const env = loadEnv({
      DATABASE_URL: "postgres://localhost:5432/ampm",
      IDENTITY_PROVIDER: "local",
      IDENTITY_LOCAL_SECRET: "a-development-secret-that-is-32chars",
    });
    expect(env.REDIS_URL).toBeUndefined();
  });

  it("refuses the stub bot check in production (C1)", () => {
    expect(() => loadEnv({ ...prodValid, BOT_CHECK_PROVIDER: "stub" })).toThrow(
      /BOT_CHECK_PROVIDER/,
    );
  });

  it("requires the verify URL and secret for the siteverify bot check (C1)", () => {
    const { BOT_CHECK_URL: _url, BOT_CHECK_SECRET: _secret, ...withoutBot } = prodValid;
    expect(() => loadEnv(withoutBot)).toThrow(/BOT_CHECK_URL/);
  });

  it("defaults to the stub bot check in development", () => {
    const env = loadEnv({
      DATABASE_URL: "postgres://localhost:5432/ampm",
      IDENTITY_PROVIDER: "local",
      IDENTITY_LOCAL_SECRET: "a-development-secret-that-is-32chars",
    });
    expect(env.BOT_CHECK_PROVIDER).toBe("stub");
  });

  it("refuses the stub payment gateway in production (feature 8.3)", () => {
    expect(() => loadEnv({ ...prodValid, PAYMENT_PROVIDER: "stub" })).toThrow(/PAYMENT_PROVIDER/);
  });

  it("requires the Razorpay keys when the gateway is razorpay", () => {
    const { RAZORPAY_KEY_ID: _id, ...withoutKey } = prodValid;
    expect(() => loadEnv(withoutKey)).toThrow(/RAZORPAY_KEY_ID/);
  });

  it("defaults to the stub payment gateway in development", () => {
    const env = loadEnv({
      DATABASE_URL: "postgres://localhost:5432/ampm",
      IDENTITY_PROVIDER: "local",
      IDENTITY_LOCAL_SECRET: "a-development-secret-that-is-32chars",
    });
    expect(env.PAYMENT_PROVIDER).toBe("stub");
  });
});

describe("loadEnv: the upload antivirus scan (AC-20.3)", () => {
  it("refuses the stub scanner in production", () => {
    expect(() => loadEnv({ ...prodValid, AV_PROVIDER: "stub" })).toThrow(/AV_PROVIDER/);
  });

  it("requires clamd's host with the clamav scanner, in every environment", () => {
    const { CLAMAV_HOST: _host, ...withoutHost } = prodValid;
    expect(() => loadEnv(withoutHost)).toThrow(/CLAMAV_HOST/);
    expect(() =>
      loadEnv({
        DATABASE_URL: "postgres://localhost:5432/ampm",
        IDENTITY_PROVIDER: "local",
        IDENTITY_LOCAL_SECRET: "a-development-secret-that-is-32chars",
        AV_PROVIDER: "clamav",
      }),
    ).toThrow(/CLAMAV_HOST/);
  });

  it("defaults to the stub in development, and to clamd's port and a 30 s timeout", () => {
    const env = loadEnv({
      DATABASE_URL: "postgres://localhost:5432/ampm",
      IDENTITY_PROVIDER: "local",
      IDENTITY_LOCAL_SECRET: "a-development-secret-that-is-32chars",
    });
    expect(env.AV_PROVIDER).toBe("stub");
    expect(env.CLAMAV_PORT).toBe(3310);
    expect(env.CLAMAV_TIMEOUT_MS).toBe(30000);
    expect(loadEnv(prodValid).AV_PROVIDER).toBe("clamav");
  });
});

describe("loadEnv: AMPM's own sign-in (D-142)", () => {
  const ampm = { ...prodValid, IDENTITY_PROVIDER: "ampm" };

  it("is the default provider, and accepted in production", () => {
    expect(loadEnv(prodValid).IDENTITY_PROVIDER).toBe("ampm");
    expect(loadEnv(ampm).IDENTITY_PROVIDER).toBe("ampm");
  });

  it("refuses the retired Cognito provider, so a stale config fails at boot", () => {
    expect(() => loadEnv({ ...ampm, IDENTITY_PROVIDER: "cognito" })).toThrow(/IDENTITY_PROVIDER/);
  });

  it("requires the token secret and the encryption key", () => {
    const { AUTH_TOKEN_SECRET, ...withoutSecret } = ampm;
    expect(AUTH_TOKEN_SECRET).toHaveLength(40);
    expect(() => loadEnv(withoutSecret)).toThrow(/AUTH_TOKEN_SECRET/);
    const { AUTH_ENCRYPTION_KEY, ...withoutKey } = ampm;
    expect(AUTH_ENCRYPTION_KEY).toBeTruthy();
    expect(() => loadEnv(withoutKey)).toThrow(/AUTH_ENCRYPTION_KEY/);
  });

  it("refuses an encryption key that is not 32 bytes", () => {
    const short = Buffer.alloc(16, 7).toString("base64");
    expect(() => loadEnv({ ...ampm, AUTH_ENCRYPTION_KEY: short })).toThrow(/AUTH_ENCRYPTION_KEY/);
  });

  it("still refuses the local provider in production", () => {
    expect(() =>
      loadEnv({ ...ampm, IDENTITY_PROVIDER: "local", IDENTITY_LOCAL_SECRET: "l".repeat(40) }),
    ).toThrow(/IDENTITY_PROVIDER/);
  });
});

describe("loadEnv: SMS and the on-screen client code (D-147)", () => {
  it("defaults to the console stub with the code kept off screen", () => {
    const env = loadEnv({
      DATABASE_URL: "postgres://localhost:5432/ampm",
      IDENTITY_PROVIDER: "local",
      IDENTITY_LOCAL_SECRET: "a-development-secret-that-is-32chars",
    });
    expect(env.SMS_PROVIDER).toBe("console");
    expect(env.CLIENT_OTP_SCREEN_ECHO).toBe(false);
  });

  it("refuses production with no SMS provider unless the code is shown on screen", () => {
    const consoleSms = { ...prodValid, SMS_PROVIDER: "console" };
    expect(() => loadEnv(consoleSms)).toThrow(/SMS_PROVIDER/);
    expect(loadEnv({ ...consoleSms, CLIENT_OTP_SCREEN_ECHO: "true" }).CLIENT_OTP_SCREEN_ECHO).toBe(
      true,
    );
  });

  it("needs a provider's key and its sign-in code template", () => {
    const { SMS_API_KEY: _key, ...withoutKey } = prodValid;
    expect(() => loadEnv(withoutKey)).toThrow(/SMS_API_KEY/);
    const { SMS_OTP_TEMPLATE: _template, ...withoutTemplate } = prodValid;
    expect(() => loadEnv(withoutTemplate)).toThrow(/SMS_OTP_TEMPLATE/);
    expect(loadEnv({ ...prodValid, SMS_PROVIDER: "msg91" }).SMS_PROVIDER).toBe("msg91");
  });

  it("needs the DLT sender ID with 2Factor, which takes it on every message", () => {
    const { SMS_SENDER_ID: _sender, ...withoutSender } = prodValid;
    expect(() => loadEnv(withoutSender)).toThrow(/SMS_SENDER_ID/);
    expect(loadEnv({ ...withoutSender, SMS_PROVIDER: "msg91" }).SMS_PROVIDER).toBe("msg91");
  });
});
