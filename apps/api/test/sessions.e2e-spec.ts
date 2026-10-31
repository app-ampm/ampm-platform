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

  it("reaps revoked and idle-expired sessions while keeping live ones", async () => {
    const pm = await prisma.user.findFirstOrThrow({ where: { identitySubject: "local:pm" } });
    const base = { userId: pm.id, idleTimeoutMinutes: 720, lastSeenAt: new Date() };
    await prisma.session.create({ data: { ...base, tokenId: "reap-live" } });
    await prisma.session.create({
      data: { ...base, tokenId: "reap-revoked", revokedAt: new Date() },
    });
    await prisma.session.create({
      data: {
        userId: pm.id,
        idleTimeoutMinutes: 1,
        tokenId: "reap-idle",
        lastSeenAt: new Date(Date.now() - 5 * 60 * 1000),
      },
    });
    const removed = await app.get(SessionReaperService).reap();
    expect(removed).toBeGreaterThanOrEqual(2);
    expect(await prisma.session.findUnique({ where: { tokenId: "reap-live" } })).not.toBeNull();
    expect(await prisma.session.findUnique({ where: { tokenId: "reap-revoked" } })).toBeNull();
    expect(await prisma.session.findUnique({ where: { tokenId: "reap-idle" } })).toBeNull();
  });

  it("refuses the token once the user's sessions are revoked", async () => {
    const token = await mint("local:pm");
    await me(token).expect(200);
    const pm = await prisma.user.findFirstOrThrow({ where: { identitySubject: "local:pm" } });
    await sessions.revokeAllForUser(pm.id, "e2e_revoke");
    const refused = await me(token).expect(401);
    expect(refused.body.error.code).toBe("unauthenticated");
  });
});
