import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../db/prisma.service.js";
import type { Env } from "../env.js";
import { DevLoginService } from "./dev-login.service.js";
import { LocalIdentityAdapter } from "./local.adapter.js";

const SECRET = "a-development-secret-that-is-long-enough-32";

/** The seeded demo prospect (demo-baseline.ts), resolved by user type rather than any identifier. */
const DEMO = {
  id: "demo-1",
  name: "Dev Demo",
  email: "demo@example.com",
  identitySubject: "local:demo",
};

function harness(overrides: Partial<Env> = {}, user: unknown = DEMO) {
  const findFirst = vi.fn(async () => user);
  const prisma = { user: { findFirst } } as unknown as PrismaService;
  const env = {
    IDENTITY_PROVIDER: "local",
    NODE_ENV: "development",
    IDENTITY_LOCAL_SECRET: SECRET,
    ...overrides,
  } as unknown as Env;
  return { service: new DevLoginService(env, prisma), findFirst };
}

describe("DevLoginService.signInDemo (dev-only demo sign-in)", () => {
  it("mints a session bound to the seeded demo account's identity subject", async () => {
    const { service, findFirst } = harness();
    const result = await service.signInDemo();
    expect(result.user).toEqual({ id: "demo-1", name: "Dev Demo", email: "demo@example.com" });
    // It resolves the single demo prospect by user type, never by a supplied email or mobile.
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userType: "demo", status: "active" }),
      }),
    );
    // The token binds to the demo account's stored identity_subject — the session key (D-033) — and
    // actually verifies, not merely non-empty.
    const verified = await new LocalIdentityAdapter(SECRET).verifyAccessToken(result.accessToken);
    expect(verified.subject).toBe("local:demo");
    expect(verified.email).toBe("demo@example.com");
  });

  it("is unauthenticated when no demo account is seeded", async () => {
    const { service } = harness({}, null);
    await expect(service.signInDemo()).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("is refused (404, denial equals absence) outside a local, non-production config", async () => {
    await expect(
      harness({ IDENTITY_PROVIDER: "cognito" }).service.signInDemo(),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(harness({ NODE_ENV: "production" }).service.signInDemo()).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(
      harness({ IDENTITY_LOCAL_SECRET: undefined }).service.signInDemo(),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});
