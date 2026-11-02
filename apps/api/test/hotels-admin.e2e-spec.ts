import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

/** Imported fixtures all carry this slug prefix so the suite cleans up after itself. */
const PREFIX = "e2e-import-";

const HEADER = "destinationSlug,name,slug,starCategory,totalRooms,demoVisible";
const CSV = [
  HEADER,
  `${PREFIX}dest,E2E Import Hotel A,${PREFIX}a,5,100,true`,
  `${PREFIX}dest,E2E Import Hotel B,${PREFIX}b,4,50,false`,
  `${PREFIX}dest,,${PREFIX}c,3,20,false`, // invalid: a hotel must have a name
].join("\n");

/**
 * Hotel spreadsheet import end to end (Module C, feature 9.1; AC-35.1). A Super Admin uploads the CSV;
 * a dry run writes nothing; a real run creates the valid hotels (and their destination) with the invalid
 * row reported by line and field; a re-run of the same file is idempotent; the staff detail carries the
 * RESTRICTED internal fields the client view hides.
 */
describe("Hotel import (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;
  let prisma: PrismaService;

  async function removeFixtures(): Promise<void> {
    const hotels = await prisma.hotel.findMany({
      where: { slug: { startsWith: PREFIX } },
      select: { id: true },
    });
    const ids = hotels.map((hotel) => hotel.id);
    if (ids.length > 0) {
      await prisma.auditEvent.deleteMany({ where: { entityType: "hotel", entityId: { in: ids } } });
      await prisma.hotel.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.destination.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  }

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const sa = async () => `Bearer ${await mint("local:admin")}`;
  const countImported = () => prisma.hotel.count({ where: { slug: { startsWith: PREFIX } } });

  it("dry-run validates and reports without writing anything", async () => {
    const res = await http()
      .post("/hotels-admin/imports")
      .set("Authorization", await sa())
      .send({ content: CSV, dryRun: true })
      .expect(200);
    expect(res.body.data).toMatchObject({
      dryRun: true,
      applied: false,
      totalRows: 3,
      created: 0,
      updated: 0,
    });
    expect(res.body.data.rejected).toHaveLength(1);
    expect(res.body.data.rejected[0]).toMatchObject({ line: 4 });
    expect(res.body.data.rejected[0].errors[0].field).toBe("name");
    expect(await countImported()).toBe(0);
  });

  it("applies the valid rows and reports the invalid one (AC-35.1)", async () => {
    const res = await http()
      .post("/hotels-admin/imports")
      .set("Authorization", await sa())
      .send({ content: CSV })
      .expect(200);
    expect(res.body.data).toMatchObject({
      dryRun: false,
      applied: true,
      totalRows: 3,
      created: 2,
      updated: 0,
      destinationsCreated: 1,
    });
    expect(res.body.data.rejected).toHaveLength(1);
    expect(await countImported()).toBe(2);

    // The import_jobs record stored the counts and the error report (AC-35.1).
    const job = await prisma.importJob.findUniqueOrThrow({
      where: { id: res.body.data.importJobId },
    });
    expect(job.status).toBe("applied");
    expect(job.rowCount).toBe(3);
    expect(job.errorReportJson).not.toBeNull();

    // A per-row audit event was written for each applied hotel (AC-21 / AC-35.1).
    const hotelA = await prisma.hotel.findFirstOrThrow({ where: { slug: `${PREFIX}a` } });
    const audits = await prisma.auditEvent.count({
      where: { entityType: "hotel", entityId: hotelA.id, action: "create" },
    });
    expect(audits).toBe(1);
  });

  it("exposes the RESTRICTED internal fields on the staff detail", async () => {
    const hotel = await prisma.hotel.findFirstOrThrow({ where: { slug: `${PREFIX}a` } });
    const res = await http()
      .get(`/hotels-admin/hotels/${hotel.id}`)
      .set("Authorization", await sa())
      .expect(200);
    expect(res.body.data).toMatchObject({ slug: `${PREFIX}a`, demoVisible: true });
    expect(res.body.data.destination.slug).toBe(`${PREFIX}dest`);
    expect(res.body.data).toHaveProperty("internalNotes"); // staff see RESTRICTED-NOTES (null here)
    expect(res.body.data.rooms).toEqual([]);
    expect(res.body.data.venues).toEqual([]);
  });

  it("is idempotent — re-running the same file updates and creates nothing", async () => {
    const res = await http()
      .post("/hotels-admin/imports")
      .set("Authorization", await sa())
      .send({ content: CSV })
      .expect(200);
    expect(res.body.data).toMatchObject({ created: 0, updated: 2, destinationsCreated: 0 });
    expect(await countImported()).toBe(2);
  });

  it("updates a destination and rejects a slug change (slug is immutable)", async () => {
    const dest = await prisma.destination.findFirstOrThrow({ where: { slug: `${PREFIX}dest` } });
    const res = await http()
      .patch(`/hotels-admin/destinations/${dest.id}`)
      .set("Authorization", await sa())
      .send({ publicVisible: true, description: "Imported destination" })
      .expect(200);
    expect(res.body.data).toMatchObject({
      slug: `${PREFIX}dest`,
      publicVisible: true,
      description: "Imported destination",
    });
    await http()
      .patch(`/hotels-admin/destinations/${dest.id}`)
      .set("Authorization", await sa())
      .send({ slug: "renamed" })
      .expect(400);
  });
});
