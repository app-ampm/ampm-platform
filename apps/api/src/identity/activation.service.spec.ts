import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../db/prisma.service.js";
import type { Env } from "../env.js";
import type { AuditService } from "../policy/audit.service.js";
import { ActivationService } from "./activation.service.js";
import type { AuthTokenService } from "./auth-token.service.js";
import type { IdentityAdapter, VerifiedIdentity } from "./identity.types.js";
import { AMPM_ISSUER, LocalIdentityAdapter } from "./local.adapter.js";

const SECRET = "a-development-secret-that-is-long-enough-32";

interface Config {
  verifiedEmail?: string | null;
  identity?: VerifiedIdentity;
  invite?: { id: string; userId: string } | null;
  user?: { id: string; email: string; status: string } | null;
  linkedElsewhere?: { id: string } | null;
  claimed?: boolean;
  /** The parts of the config the dev gate reads; the development provider unless a test says otherwise. */
  env?: Partial<Env>;
}

function build(cfg: Config = {}) {
  const verifyAccessToken = vi.fn(
    async (): Promise<VerifiedIdentity> =>
      cfg.identity ?? {
        subject: "sub-1",
        provider: "local",
        tokenId: "jti",
        expiresAt: new Date("2026-11-30T00:00:00.000Z"),
        email: cfg.verifiedEmail === undefined ? "u@x.com" : cfg.verifiedEmail,
        phone: null,
      },
  );
  const findValidInvite = vi.fn(async () =>
    cfg.invite === undefined ? { id: "t1", userId: "u1" } : cfg.invite,
  );
  const markUsedIfLive = vi.fn(async () => cfg.claimed ?? true);
  const record = vi.fn(async () => undefined);
  const txUserUpdate = vi.fn(async () => undefined);
  const txMemberUpdateMany = vi.fn(async () => ({ count: 1 }));
  const userFindFirst = vi
    .fn()
    .mockResolvedValueOnce(
      cfg.user === undefined ? { id: "u1", email: "u@x.com", status: "invited" } : cfg.user,
    )
    .mockResolvedValueOnce(cfg.linkedElsewhere ?? null);
  const prisma = {
    user: { findFirst: userFindFirst },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        user: { update: txUserUpdate },
        projectMember: { updateMany: txMemberUpdateMany },
      }),
  } as unknown as PrismaService;
  const identity = { verifyAccessToken } as unknown as IdentityAdapter;
  const tokens = { findValidInvite, markUsedIfLive } as unknown as AuthTokenService;
  const audit = { record } as unknown as AuditService;
  const env = {
    IDENTITY_PROVIDER: "local",
    NODE_ENV: "development",
    IDENTITY_LOCAL_SECRET: SECRET,
    ...cfg.env,
  } as unknown as Env;
  return {
    service: new ActivationService(env, identity, tokens, prisma, audit),
    verifyAccessToken,
    findValidInvite,
    txUserUpdate,
    txMemberUpdateMany,
    markUsedIfLive,
    record,
  };
}

describe("ActivationService", () => {
  it("links the subject, activates, claims the invite, and audits it", async () => {
    const { service, txUserUpdate, markUsedIfLive, record } = build({ verifiedEmail: "u@x.com" });
    const result = await service.activate("raw", "access");
    expect(result).toEqual({ userId: "u1", status: "active" });
    expect(markUsedIfLive).toHaveBeenCalledWith("t1", expect.anything());
    expect(txUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u1" },
        data: { identitySubject: "sub-1", status: "active" },
      }),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "update", entityType: "user" }),
      expect.anything(),
    );
  });

  it("flips the user's invited memberships to active on activation (B1)", async () => {
    const { service, txMemberUpdateMany } = build({ verifiedEmail: "u@x.com" });
    await service.activate("raw", "access");
    expect(txMemberUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u1", status: "invited", deletedAt: null },
        data: expect.objectContaining({ status: "active" }),
      }),
    );
  });

  it("matches the email case-insensitively", async () => {
    const { service } = build({ verifiedEmail: "U@X.COM" });
    await expect(service.activate("raw", "access")).resolves.toMatchObject({ status: "active" });
  });

  it("refuses when the provider gives no email (fail closed)", async () => {
    const { service, markUsedIfLive } = build({ verifiedEmail: null });
    await expect(service.activate("raw", "access")).rejects.toMatchObject({ code: "forbidden" });
    expect(markUsedIfLive).not.toHaveBeenCalled();
  });

  it("rejects a sign-in email that does not match the invitation", async () => {
    const { service } = build({ verifiedEmail: "someone-else@x.com" });
    await expect(service.activate("raw", "access")).rejects.toMatchObject({ code: "forbidden" });
  });

  it("rejects an invalid or expired invite", async () => {
    const { service } = build({ invite: null });
    await expect(service.activate("raw", "access")).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("rejects an already-activated account", async () => {
    const { service } = build({ user: { id: "u1", email: "u@x.com", status: "active" } });
    await expect(service.activate("raw", "access")).rejects.toMatchObject({ code: "conflict" });
  });

  it("rejects a provider subject already linked to another account", async () => {
    const { service } = build({ linkedElsewhere: { id: "u2" } });
    await expect(service.activate("raw", "access")).rejects.toMatchObject({ code: "conflict" });
  });

  it("refuses when a concurrent activation already claimed the invite", async () => {
    const { service, txUserUpdate } = build({ claimed: false });
    await expect(service.activate("raw", "access")).rejects.toMatchObject({ code: "conflict" });
    expect(txUserUpdate).not.toHaveBeenCalled();
  });

  // The adapter -> service seam for the D-041 gate: a VerifiedIdentity produced by the real token
  // adapter (the dev provider and AMPM's own sign-in share it), so a regression in either the email
  // claim mapping or the guard is caught together.
  it("activates when the token's email matches the invitation", async () => {
    const adapter = new LocalIdentityAdapter(SECRET);
    const token = await adapter.mint("local:u1", { email: "u@x.com" });
    const { service } = build({ identity: await adapter.verifyAccessToken(token) });
    await expect(service.activate("raw", "access")).resolves.toMatchObject({ status: "active" });
  });

  it("fails closed when the token carries no email", async () => {
    const adapter = new LocalIdentityAdapter(SECRET);
    const identity = await adapter.verifyAccessToken(await adapter.mint("local:u1"));
    const { service, markUsedIfLive } = build({ identity });
    await expect(service.activate("raw", "access")).rejects.toMatchObject({ code: "forbidden" });
    expect(markUsedIfLive).not.toHaveBeenCalled();
  });

  // D-162: AMPM's own sign-in activates through the password and authenticator routes. This route is
  // public, so a token whose session an administrator's reset revoked still verifies here; under `ampm`
  // it activated a reset account with no password and no authenticator.
  it("is a 404 under AMPM's own sign-in, even for a valid token and invitation, and writes nothing", async () => {
    const adapter = new LocalIdentityAdapter(SECRET, { issuer: AMPM_ISSUER, provider: "ampm" });
    const identity = await adapter.verifyAccessToken(
      await adapter.mint("ampm:u1", { email: "u@x.com" }),
    );
    const { service, verifyAccessToken, findValidInvite, markUsedIfLive, txUserUpdate, record } =
      build({ identity, env: { IDENTITY_PROVIDER: "ampm" } });
    await expect(service.activate("raw", "access")).rejects.toMatchObject({ code: "not_found" });
    expect(verifyAccessToken).not.toHaveBeenCalled();
    expect(findValidInvite).not.toHaveBeenCalled();
    expect(markUsedIfLive).not.toHaveBeenCalled();
    expect(txUserUpdate).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it("refuses a request without a token in a dev build, and is a 404 for one outside it", async () => {
    const { service, findValidInvite } = build();
    await expect(service.activate("raw", null)).rejects.toMatchObject({ code: "unauthenticated" });
    expect(findValidInvite).not.toHaveBeenCalled();
    const ampm = build({ env: { IDENTITY_PROVIDER: "ampm" } });
    await expect(ampm.service.activate("raw", null)).rejects.toMatchObject({ code: "not_found" });
  });

  it("is a 404 in production and without the local secret", async () => {
    const production = build({ env: { NODE_ENV: "production" } });
    await expect(production.service.activate("raw", "access")).rejects.toMatchObject({
      code: "not_found",
    });
    const unkeyed = build({ env: { IDENTITY_LOCAL_SECRET: undefined } });
    await expect(unkeyed.service.activate("raw", "access")).rejects.toMatchObject({
      code: "not_found",
    });
    expect(production.txUserUpdate).not.toHaveBeenCalled();
    expect(unkeyed.txUserUpdate).not.toHaveBeenCalled();
  });
});
