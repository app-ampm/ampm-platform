import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../db/prisma.service.js";
import type { Env } from "../env.js";
import { DevOtpService } from "./dev-otp.service.js";
import { LocalIdentityAdapter } from "./local.adapter.js";

const PHONE = "+911234567003"; // the seeded demo client (Rhea), already E.164-normalised by the schema.

const CLIENT = {
  id: "client-1",
  name: "Rhea Client",
  email: "client@example.com",
  identitySubject: "local:client",
};

const SECRET = "a-development-secret-that-is-long-enough-32";

function harness(overrides: Partial<Env> = {}, user: unknown = CLIENT) {
  const findFirst = vi.fn(async () => user);
  const prisma = { user: { findFirst } } as unknown as PrismaService;
  const env = {
    IDENTITY_PROVIDER: "local",
    NODE_ENV: "development",
    IDENTITY_LOCAL_SECRET: SECRET,
    ...overrides,
  } as unknown as Env;
  return { service: new DevOtpService(env, prisma), findFirst };
}

/** A six-digit code guaranteed to differ from the real one. */
function wrong(code: string): string {
  return String((Number(code) + 1) % 1_000_000).padStart(6, "0");
}

describe("DevOtpService (dev-only demo OTP)", () => {
  it("issues a six-digit code for a seeded client and verifies it into a session", async () => {
    const { service } = harness();
    const { demoCode, expiresInSeconds } = await service.sendOtp(PHONE);
    expect(demoCode).toMatch(/^\d{6}$/);
    expect(expiresInSeconds).toBeGreaterThan(0);

    const result = await service.verifyOtp(PHONE, demoCode);
    expect(result.user).toEqual({
      id: "client-1",
      name: "Rhea Client",
      email: "client@example.com",
    });
    // The minted token binds to the client's stored identity_subject — the session key (D-033) — and
    // actually verifies, not merely non-empty.
    const verified = await new LocalIdentityAdapter(SECRET).verifyAccessToken(result.accessToken);
    expect(verified.subject).toBe("local:client");
    expect(verified.email).toBe("client@example.com");

    // The code is single-use: it is refused once it has signed someone in (no replay within the TTL).
    await expect(service.verifyOtp(PHONE, demoCode)).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("rejects a wrong code and burns it after too many attempts", async () => {
    const { service } = harness();
    const { demoCode } = await service.sendOtp(PHONE);
    for (let i = 0; i < 5; i += 1) {
      await expect(service.verifyOtp(PHONE, wrong(demoCode))).rejects.toMatchObject({
        code: "unauthenticated",
      });
    }
    // The next try is refused even with the right code — the code is burned, not just this attempt.
    await expect(service.verifyOtp(PHONE, demoCode)).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("rejects an expired code", async () => {
    vi.useFakeTimers();
    try {
      const { service } = harness();
      const { demoCode } = await service.sendOtp(PHONE);
      vi.advanceTimersByTime(6 * 60_000); // past the 5-minute TTL
      await expect(service.verifyOtp(PHONE, demoCode)).rejects.toMatchObject({
        code: "unauthenticated",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("is a 404 (denial equals absence) for a number with no active client", async () => {
    const { service } = harness({}, null);
    await expect(service.sendOtp(PHONE)).rejects.toMatchObject({ code: "not_found" });
  });

  it("is refused outside a local, non-production config (no code is ever generated)", async () => {
    await expect(
      harness({ IDENTITY_PROVIDER: "cognito" }).service.sendOtp(PHONE),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(harness({ NODE_ENV: "production" }).service.sendOtp(PHONE)).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(
      harness({ IDENTITY_LOCAL_SECRET: undefined }).service.sendOtp(PHONE),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(
      harness({ IDENTITY_PROVIDER: "cognito" }).service.verifyOtp(PHONE, "123456"),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(
      harness({ NODE_ENV: "production" }).service.verifyOtp(PHONE, "123456"),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(
      harness({ IDENTITY_LOCAL_SECRET: undefined }).service.verifyOtp(PHONE, "123456"),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});
