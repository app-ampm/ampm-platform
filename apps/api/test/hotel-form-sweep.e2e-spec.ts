import { createHash, randomBytes } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import type { Prisma } from "../src/generated/prisma/client.js";
import {
  challengeSweepJob,
  HotelFormChallengeSweepService,
} from "../src/modules/hotels/hotel-form/hotel-form-challenge-sweep.service.js";
import {
  freshMobile,
  signIn,
  startFormSuite,
  stopFormSuite,
  testLink,
  type FormSuite,
  type IssuedLink,
} from "./hotel-form-suite.js";

/*
 * The hourly retirement of abandoned code challenges (D-189 §1; D-180's retention) against the test
 * database: a challenge whose code expired unused is retired and its claim cleared (the CHECK lets the claim
 * live only while the challenge is open); an open, unexpired challenge and a used one are left alone; each
 * run is recorded on job_runs, and a second run retires nothing.
 */
/** What a sweep run records on job_runs. */
const runOutcome = z.object({ retired: z.number().int().nonnegative() });

describe("The hotel form's challenge sweep (e2e, D-189 §1)", () => {
  let suite: FormSuite;
  let link: IssuedLink;
  const MINUTE = 60_000;

  beforeAll(async () => {
    suite = await startFormSuite("e2e-hf-sweep-");
    link = await testLink(suite);
  });

  afterAll(async () => {
    await suite.prisma.jobRun.deleteMany({ where: { jobName: challengeSweepJob.name } });
    await stopFormSuite(suite);
  });

  const challenge = (data: Partial<Prisma.HotelInfoRequestChallengeUncheckedCreateInput>) =>
    suite.prisma.hotelInfoRequestChallenge.create({
      data: {
        requestId: link.id,
        linkGeneration: 1,
        claimedFullName: "E2E Abandoned Claimant",
        claimedDesignation: "Sales Manager",
        claimedPhone: freshMobile(),
        claimedNoticeVersion: "hf-notice-e2e",
        delivery: "screen",
        destinationHash: createHash("sha256").update(randomBytes(16)).digest("hex"),
        codeHmac: createHash("sha256").update(randomBytes(16)).digest("hex"),
        codeExpiresAt: new Date(Date.now() + 5 * MINUTE),
        ...data,
      },
    });

  it("retires the expired, unused challenges and clears their claims, leaving the rest", async () => {
    const expired = await challenge({ codeExpiresAt: new Date(Date.now() - MINUTE) });
    const open = await challenge({});
    const { challengeId: used } = await signIn(suite, link.secret, freshMobile());
    const sweep = suite.app.get(HotelFormChallengeSweepService);
    expect(await sweep.run(new Date())).toBeGreaterThanOrEqual(1);
    const rows = await suite.prisma.hotelInfoRequestChallenge.findMany({
      where: { id: { in: [expired.id, open.id, used] } },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get(expired.id)).toMatchObject({
      claimedFullName: null,
      claimedDesignation: null,
      claimedPhone: null,
      claimedNoticeVersion: null,
      usedAt: null,
    });
    expect(byId.get(expired.id)?.retiredAt).not.toBeNull();
    expect(byId.get(open.id)).toMatchObject({
      retiredAt: null,
      claimedFullName: "E2E Abandoned Claimant",
    });
    expect(byId.get(used)).toMatchObject({ retiredAt: null });
    expect(byId.get(used)?.usedAt).not.toBeNull();
  });

  it("records each run on job_runs, and a second run retires nothing", async () => {
    await challenge({ codeExpiresAt: new Date(Date.now() - MINUTE) });
    const sweep = suite.app.get(HotelFormChallengeSweepService);
    expect(await sweep.run(new Date())).toBeGreaterThanOrEqual(1);
    expect(await sweep.run(new Date())).toBe(0);
    // Both runs may start in the same millisecond, so their order is not asserted.
    const runs = await suite.prisma.jobRun.findMany({
      where: { jobName: challengeSweepJob.name },
      orderBy: { startedAt: "desc" },
      take: 2,
    });
    expect(runs.map((run) => run.status)).toEqual(["succeeded", "succeeded"]);
    const retired = runs.map((run) => runOutcome.parse(run.detailJson).retired);
    expect(retired).toContain(0);
    expect(retired.some((count) => count >= 1)).toBe(true);
  });
});
