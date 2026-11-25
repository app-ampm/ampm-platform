import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaService } from "../src/db/prisma.service.js";
import {
  newSuiteHotel,
  requestCalls,
  startRequestSuite,
  stopRequestSuite,
  type RequestSuite,
} from "./hotel-info-requests-suite.js";

/** A transaction holding a request's row, as a revoke still writing it does. */
interface HeldRevoke {
  /** Its database backend, which the change under test waits behind. */
  readonly pid: number;
  /** Commits it: the request is then revoked. */
  readonly release: () => void;
  readonly done: Promise<void>;
}

/**
 * Starts a revoke that has written the request but not committed yet: the row is locked and marked
 * revoked, and the transaction stays open until `release`.
 */
async function holdRevoke(prisma: PrismaService, id: string): Promise<HeldRevoke> {
  let release = (): void => undefined;
  const released = new Promise<void>((resolve) => (release = resolve));
  let started = (_pid: number): void => undefined;
  const pid = new Promise<number>((resolve) => (started = resolve));
  const done = prisma.$transaction(
    async (tx) => {
      const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      await tx.$queryRaw`SELECT id FROM hotel_info_requests WHERE id = ${id}::uuid FOR UPDATE`;
      await tx.hotelInfoRequest.update({
        where: { id },
        data: { status: "revoked", revokedAt: new Date(), revokeReason: "E2E race revoke" },
      });
      started(backend?.pid ?? -1);
      await released;
    },
    { maxWait: 5_000, timeout: 15_000 },
  );
  return { pid: await pid, release, done };
}

/** Waits until another backend is blocked behind `pid`'s locks; throws if none is within five seconds. */
async function blockedBehind(prisma: PrismaService, pid: number): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const [row] = await prisma.$queryRaw<{ waiting: number }[]>`
      SELECT count(*)::int AS waiting FROM pg_stat_activity
      WHERE ${pid}::int = ANY(pg_blocking_pids(pid))`;
    if ((row?.waiting ?? 0) > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("no change waited for the revoke under way");
}

/**
 * Changes racing a revoke (D-188 §3): a change to a request locks its row before reading it, so a change
 * that arrives while a revoke is writing waits for it, then finds the request read-only (409) and writes
 * nothing; and a hotel's deletion that meets its request revoked meanwhile leaves that revoke as it is
 * and still deletes the hotel. Each race is held open by a transaction of the test's own.
 */
describe("Hotel information requests: changes racing a revoke (e2e)", () => {
  let suite: RequestSuite;
  const { create, patch, shareRecord } = requestCalls(() => suite);

  async function openRequest(suffix: string): Promise<{ hotelId: string; id: string }> {
    const hotelId = await newSuiteHotel(suite, suffix, { status: "active" });
    const created = await create("ht", { target: "existing", hotelId }).expect(201);
    return { hotelId, id: created.body.data.request.id as string };
  }

  /** Runs `call` while a revoke holds the request, then lets the revoke commit; answers its status. */
  async function raceRevoke(id: string, call: () => Promise<{ status: number }>): Promise<number> {
    const held = await holdRevoke(suite.prisma, id);
    try {
      const answer = call();
      await blockedBehind(suite.prisma, held.pid);
      held.release();
      await held.done;
      return (await answer).status;
    } finally {
      held.release();
      await held.done.catch(() => undefined);
    }
  }

  beforeAll(async () => {
    suite = await startRequestSuite("e2e-hir-race-");
  });

  afterAll(async () => {
    await stopRequestSuite(suite);
  });

  it("makes a PATCH wait for a revoke under way, then refuses it (409), writing nothing", async () => {
    const { id } = await openRequest("patch");
    const status = await raceRevoke(id, async () =>
      patch("ht", id, { staffNote: "E2E late note", extendDays: 5 }),
    );
    expect(status).toBe(409);
    const row = await suite.prisma.hotelInfoRequest.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ status: "revoked", staffNote: null });
    const events = await suite.prisma.hotelInfoRequestEvent.findMany({
      where: { requestId: id, eventType: { in: ["updated", "expiry_extended"] } },
    });
    expect(events).toEqual([]);
  });

  it("makes a share record wait for a revoke under way, then refuses it (409), recording nothing", async () => {
    const { id } = await openRequest("share");
    const status = await raceRevoke(id, async () => shareRecord("ht", id, { channel: "copy" }));
    expect(status).toBe(409);
    const shares = await suite.prisma.hotelInfoRequestEvent.count({
      where: { requestId: id, eventType: "share_recorded" },
    });
    const audits = await suite.prisma.auditEvent.count({
      where: { entityId: id, action: "share" },
    });
    expect({ shares, audits }).toEqual({ shares: 0, audits: 1 }); // the create's audit alone
  });

  it("deletes a hotel whose request staff revoke meanwhile: their revoke stands, and the delete succeeds", async () => {
    const { hotelId, id } = await openRequest("delete");
    const status = await raceRevoke(id, async () =>
      request(suite.app.getHttpServer())
        .delete(`/hotels-admin/hotels/${hotelId}`)
        .set("Authorization", suite.bearer.sa),
    );
    expect(status).toBe(200);
    const row = await suite.prisma.hotelInfoRequest.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ status: "revoked", revokeReason: "E2E race revoke" });
    const systemRevokes = await suite.prisma.hotelInfoRequestEvent.count({
      where: { requestId: id, eventType: "revoked", actorKind: "system" },
    });
    expect(systemRevokes).toBe(0);
    const hotel = await suite.prisma.hotel.findUniqueOrThrow({ where: { id: hotelId } });
    expect(hotel.deletedAt).not.toBeNull();
  });
});
