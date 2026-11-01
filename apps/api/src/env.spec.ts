import { describe, expect, it } from "vitest";

import { loadEnv } from "./env.js";

const prodValid = {
  NODE_ENV: "production",
  DATABASE_URL: "postgres://localhost:5432/ampm",
  COGNITO_REGION: "ap-south-1",
  COGNITO_USER_POOL_ID: "pool",
  COGNITO_CLIENT_ID: "client",
  EMAIL_PROVIDER: "smtp",
  SMTP_HOST: "smtp.example.com",
  EMAIL_FROM: "AMPM <no-reply@ampm.example>",
  WEB_APP_URL: "https://app.ampm.example",
  TRUST_PROXY: "1",
  REDIS_URL: "redis://redis:6379",
  BOT_CHECK_PROVIDER: "siteverify",
  BOT_CHECK_URL: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
  BOT_CHECK_SECRET: "bot-secret",
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
});
