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

function createHarness(overrides: Partial<Env> = {}, taken: unknown = null) {
  const findFirst = vi.fn(async () => taken);
  const userCreate = vi.fn(async () => ({ id: "new-client-1" }));
  const accountCreate = vi.fn(async () => ({ id: "new-account-1" }));
  const contactCreate = vi.fn(async () => ({ id: "new-contact-1" }));
  const prisma = {
    user: { findFirst, create: userCreate },
    clientAccount: { create: accountCreate },
    accountContact: { create: contactCreate },
  } as unknown as PrismaService;
  const env = {
    IDENTITY_PROVIDER: "local",
    NODE_ENV: "development",
    IDENTITY_LOCAL_SECRET: SECRET,
    ...overrides,
  } as unknown as Env;
  return { service: new DevOtpService(env, prisma), userCreate, accountCreate, contactCreate };
}

describe("DevOtpService.createClient (dev-only demo client)", () => {
  it("creates an ACTIVE prospect client, its account AND the contact that links them", async () => {
    const { service, userCreate, accountCreate, contactCreate } = createHarness();
    const result = await service.createClient("  Aditi Sharma  ", PHONE);
    expect(result).toEqual({ userId: "new-client-1", phone: PHONE });
    // An active client user with the trimmed name and the given mobile, so the later OTP lookup finds it.
    expect(userCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userType: "client",
          status: "active",
          name: "Aditi Sharma",
          phone: PHONE,
        }),
      }),
    );
    // A prospect account (never is_demo), so the client's OWN purchase is what opens every hotel.
    expect(accountCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "prospect",
          primaryContactUserId: "new-client-1",
        }),
      }),
    );
    // The `self` contact row (account_contacts.user_id) is the link entitlements AND the subscription
    // purchase read — without it the client sees no hotels and the ₹50k purchase 404s.
    expect(contactCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: "new-account-1",
          userId: "new-client-1",
          relation: "self",
          isDecisionMaker: true,
        }),
      }),
    );
  });

  it("refuses a mobile already in use, creating nothing", async () => {
    const { service, userCreate, contactCreate } = createHarness({}, { id: "existing" });
    await expect(service.createClient("Aditi", PHONE)).rejects.toMatchObject({ code: "conflict" });
    expect(userCreate).not.toHaveBeenCalled();
    expect(contactCreate).not.toHaveBeenCalled();
  });

  it("is refused outside a local, non-production config (creates nothing)", async () => {
    const cognito = createHarness({ IDENTITY_PROVIDER: "cognito" });
    await expect(cognito.service.createClient("A", PHONE)).rejects.toMatchObject({
      code: "not_found",
    });
    expect(cognito.userCreate).not.toHaveBeenCalled();
    await expect(
      createHarness({ NODE_ENV: "production" }).service.createClient("A", PHONE),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});
