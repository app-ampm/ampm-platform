import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { SessionReaperService } from "../src/policy/session-reaper.service.js";
import { SessionService } from "../src/policy/session.service.js";
import { startApi } from "./start-api.js";

/** The `jti` inside a local access token, read from its payload without verifying. */
function jtiOf(token: string): string {
  const part = token.split(".")[1] ?? "";
  const payload: { jti?: string } = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  return payload.jti ?? "";
}

describe("Sessions (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;
  let prisma: PrismaService;
  let sessions: SessionService;

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    sessions = app.get(SessionService);
  });

  afterAll(async () => {
    await prisma.session.deleteMany({});
    await app.close();
  });

  const me = (bearer: string) =>
    request(app.getHttpServer()).get("/me").set("authorization", `Bearer ${bearer}`);

  it("opens one session for a token and reuses it on the next request", async () => {
    const token = await mint("local:pm");
    await me(token).expect(200);
    await me(token).expect(200);
    const rows = await prisma.session.findMany({ where: { tokenId: jtiOf(token) } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.revokedAt).toBeNull();
  });

  it("opens exactly one session under a burst of concurrent first requests", async () => {
    const token = await mint("local:pm");
    // All four hit the auth guard with a token that has no session yet: the unique token_id index
    // makes the losers of the insert race re-use the winner's row rather than 500 (D-033 review).
    const responses = await Promise.all([me(token), me(token), me(token), me(token)]);
    for (const response of responses) expect(response.status).toBe(200);
    const rows = await prisma.session.findMany({ where: { tokenId: jtiOf(token) } });
    expect(rows).toHaveLength(1);
  });

  it("reaps only sessions whose token has expired, keeping live/revoked/idle rows until then (A2)", async () => {
    const pm = await prisma.user.findFirstOrThrow({ where: { identitySubject: "local:pm" } });
    // Margins far larger than any clock skew between the test runner and the database (a local dev
    // Postgres can report now() hours off): the boundary under test is expired-vs-not, not a tight window.
    const day = 24 * 60 * 60 * 1000;
    const future = new Date(Date.now() + 365 * day);
    const past = new Date(Date.now() - 365 * day);
    const base = { userId: pm.id, idleTimeoutMinutes: 720, lastSeenAt: new Date() };
    // A live token, a revoked one and an idle one all still unexpired: all kept, so the revoked and
    // idle ones stay denied by the session service rather than being deleted and reopened by the token.
    await prisma.session.create({ data: { ...base, tokenId: "reap-live", expiresAt: future } });
    await prisma.session.create({
      data: { ...base, tokenId: "reap-revoked-live", revokedAt: new Date(), expiresAt: future },
    });
    await prisma.session.create({
      data: {
        userId: pm.id,
        idleTimeoutMinutes: 1,
        tokenId: "reap-idle-live",
        lastSeenAt: new Date(Date.now() - 5 * 60 * 1000),
        expiresAt: future,
      },
    });
    // Only this one's token has expired (so re-presenting it fails at verify): the reaper removes it.
    await prisma.session.create({ data: { ...base, tokenId: "reap-expired", expiresAt: past } });

    const removed = await app.get(SessionReaperService).reap();
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(await prisma.session.findUnique({ where: { tokenId: "reap-live" } })).not.toBeNull();
    expect(
      await prisma.session.findUnique({ where: { tokenId: "reap-revoked-live" } }),
    ).not.toBeNull();
    expect(
      await prisma.session.findUnique({ where: { tokenId: "reap-idle-live" } }),
    ).not.toBeNull();
    expect(await prisma.session.findUnique({ where: { tokenId: "reap-expired" } })).toBeNull();
  });

  it("refuses the token once the user's sessions are revoked", async () => {
    const token = await mint("local:pm");
    await me(token).expect(200);
    const pm = await prisma.user.findFirstOrThrow({ where: { identitySubject: "local:pm" } });
    await sessions.revokeAllForUser(pm.id, "e2e_revoke");
    const refused = await me(token).expect(401);
    expect(refused.body.error.code).toBe("unauthenticated");
  });

  it("does not resurrect a revoked token after the reaper runs (A2)", async () => {
    const token = await mint("local:pm");
    await me(token).expect(200);
    const pm = await prisma.user.findFirstOrThrow({ where: { identitySubject: "local:pm" } });
    await sessions.revokeAllForUser(pm.id, "e2e_revoke_reap");
    await me(token).expect(401);
    // The hourly reaper runs while the token is still valid. Before the fix it deleted the revoked row
    // and the next request reopened a fresh live session; now the row survives and the token stays refused.
    await app.get(SessionReaperService).reap();
    const refused = await me(token).expect(401);
    expect(refused.body.error.code).toBe("unauthenticated");
    const rows = await prisma.session.findMany({ where: { tokenId: jtiOf(token) } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.revokedAt).not.toBeNull();
  });
});
