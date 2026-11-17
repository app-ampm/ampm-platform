import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../db/prisma.service.js";
import type { Env } from "../env.js";
import type { AuthTokenService } from "./auth-token.service.js";
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

function harness(overrides: Partial<Env> = {}, user: unknown = DEMO, invite: unknown = null) {
  const findFirst = vi.fn(async () => user);
  const prisma = { user: { findFirst } } as unknown as PrismaService;
  const findValidInvite = vi.fn(async () => invite);
  const tokens = { findValidInvite } as unknown as AuthTokenService;
  const env = {
    IDENTITY_PROVIDER: "local",
    NODE_ENV: "development",
    IDENTITY_LOCAL_SECRET: SECRET,
    ...overrides,
  } as unknown as Env;
  return { service: new DevLoginService(env, prisma, tokens), findFirst, findValidInvite };
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

/** An invited account with a live invitation, as a staff invite or a client invite leaves it. */
const INVITED = {
  id: "user-7",
  name: "Ira Invited",
  email: "ira@example.com",
  status: "invited",
};
const LIVE_INVITE = { id: "invite-1", userId: "user-7" };

describe("DevLoginService.signInForInvite (the local stand-in for the provider sign-in)", () => {
  it("mints a token for the invited account: a subject of its own and the invited email", async () => {
    const { service, findValidInvite, findFirst } = harness({}, INVITED, LIVE_INVITE);
    const result = await service.signInForInvite("raw-invite");
    expect(findValidInvite).toHaveBeenCalledWith("raw-invite");
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-7", deletedAt: null } }),
    );
    expect(result.user).toEqual({ id: "user-7", name: "Ira Invited", email: "ira@example.com" });
    // /auth/activate will match the token's email to the invitation and link its subject.
    const verified = await new LocalIdentityAdapter(SECRET).verifyAccessToken(result.accessToken);
    expect(verified.subject).toBe("local:user-7");
    expect(verified.email).toBe("ira@example.com");
  });

  it("is unauthenticated, with activation's message, for a dead or unknown invitation", async () => {
    const { service, findFirst } = harness({}, INVITED, null);
    await expect(service.signInForInvite("stale")).rejects.toMatchObject({
      code: "unauthenticated",
      message: "Invalid or expired invitation",
    });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("is unauthenticated when the invited account has been removed", async () => {
    const { service } = harness({}, null, LIVE_INVITE);
    await expect(service.signInForInvite("raw-invite")).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("is a conflict, with activation's message, once the account is no longer invited", async () => {
    const { service } = harness({}, { ...INVITED, status: "active" }, LIVE_INVITE);
    await expect(service.signInForInvite("raw-invite")).rejects.toMatchObject({
      code: "conflict",
      message: "This account is already activated",
    });
  });

  it("is refused (404, denial equals absence) outside a local, non-production config", async () => {
    for (const env of [
      { IDENTITY_PROVIDER: "cognito" },
      { NODE_ENV: "production" },
      { IDENTITY_LOCAL_SECRET: undefined },
    ] as const) {
      const { service, findValidInvite } = harness(env, INVITED, LIVE_INVITE);
      await expect(service.signInForInvite("raw-invite")).rejects.toMatchObject({
        code: "not_found",
      });
      // Refused before the invitation is even looked up.
      expect(findValidInvite).not.toHaveBeenCalled();
    }
  });
});
