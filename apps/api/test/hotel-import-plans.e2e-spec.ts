import type { NestExpressApplication } from "@nestjs/platform-express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import type { ImportStatus, ImportType } from "../src/generated/prisma/client.js";
import {
  HotelImportPlanSweepService,
  importPlanSweepJob,
} from "../src/modules/hotels/hotel-import-plan-sweep.service.js";
import { startApi } from "./start-api.js";

const HOUR_MS = 60 * 60 * 1000;

/** A plan as a preview keeps one; the sweep never reads it. Synthetic. */
const PLAN = { version: 1, kind: "rooms", totalRows: 1, rows: [], refused: [] };

/**
 * The daily clearing of expired staff import previews' plans (D-181; security.md) against the migrated
 * test database: a plan, which holds a file's values with internal notes among them, is cleared once its
 * preview is past the 24-hour limit or no longer validating, for the hotel imports only; the job rows stay
 * with their value-free reports, and a second run clears nothing. Each run is recorded on `job_runs`.
 */
describe("Clearing expired import plans (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let sweep: HotelImportPlanSweepService;
  const created: string[] = [];

  /** An import job as a preview leaves it, made `hoursOld` hours ago. */
  async function job(importType: ImportType, status: ImportStatus, hoursOld: number) {
    const row = await prisma.importJob.create({
      data: {
        importType,
        status,
        planJson: PLAN,
        createdAt: new Date(Date.now() - hoursOld * HOUR_MS),
      },
      select: { id: true },
    });
    created.push(row.id);
    return row.id;
  }

  const planOf = async (id: string) =>
    (await prisma.importJob.findUniqueOrThrow({ where: { id } })).planJson;

  beforeAll(async () => {
    ({ app } = await startApi());
    prisma = app.get(PrismaService);
    sweep = app.get(HotelImportPlanSweepService);
    await prisma.jobRun.deleteMany({ where: { jobName: importPlanSweepJob.name } });
  });

  afterAll(async () => {
    await prisma.importJob.deleteMany({ where: { id: { in: created } } });
    await prisma.jobRun.deleteMany({ where: { jobName: importPlanSweepJob.name } });
    await app.close();
  });

  it("clears the hotel imports' plans past the limit or off validating, and only those", async () => {
    const expired = await job("hotel_rooms", "validating", 25);
    const failed = await job("hotel_venues", "failed", 1);
    const fresh = await job("hotels", "validating", 23);
    const guests = await job("guests", "validating", 25);
    expect(await sweep.run()).toBeGreaterThanOrEqual(2);
    expect(await planOf(expired)).toBeNull();
    expect(await planOf(failed)).toBeNull();
    expect(await planOf(fresh)).toEqual(PLAN);
    expect(await planOf(guests)).toEqual(PLAN);
    // The job rows stay as they were otherwise, and a second run finds nothing left to clear.
    const kept = await prisma.importJob.findUniqueOrThrow({ where: { id: expired } });
    expect(kept).toMatchObject({ status: "validating", importType: "hotel_rooms" });
    expect(await sweep.run()).toBe(0);
  });

  it("records each run on job_runs with its count", async () => {
    await prisma.jobRun.deleteMany({ where: { jobName: importPlanSweepJob.name } });
    await job("hotels", "validating", 30);
    expect(await sweep.run()).toBe(1);
    const runs = await prisma.jobRun.findMany({ where: { jobName: importPlanSweepJob.name } });
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ status: "succeeded", detailJson: { cleared: 1 } });
  });
});
