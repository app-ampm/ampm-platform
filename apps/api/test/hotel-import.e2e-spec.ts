import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

/** Every fixture's web address and destination carries this prefix, so the suite cleans up after itself. */
const PREFIX = "e2e-csv-";
const COAST = `${PREFIX}coast`;
const ROUTE = "/hotels-admin/imports/hotels";
const HEADER =
  "destinationSlug,name,slug,brand,status,demoVisible,publicShowcase,city,minNights,internalNotes";
const csv = (...rows: string[]) => [HEADER, ...rows].join("\n");
const KEPT = `${COAST},E2E CSV Kept,${PREFIX}kept,,,,,,,`;

interface UploadOptions {
  readonly dryRun?: boolean;
  readonly type?: string;
  readonly auth?: string | null;
}

/**
 * The safe hotel import (Module C; AC-35.1; D-181), end to end over the raw CSV upload. A blank cell leaves
 * a value unchanged, so a re-import after a staff edit keeps the edit, its status and its flags; the dry run
 * names the fields each row changes; a deleted hotel's web address is a row error while the rest applies;
 * the body is read only after the guards, within 5 MiB, as a file. All fixtures are synthetic.
 */
describe("Safe hotel import (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;
  let prisma: PrismaService;
  let admin = "";

  async function removeFixtures(): Promise<void> {
    const hotels = await prisma.hotel.findMany({ where: { slug: { startsWith: PREFIX } } });
    const ids = hotels.map((hotel) => hotel.id);
    await prisma.auditEvent.deleteMany({ where: { entityType: "hotel", entityId: { in: ids } } });
    await prisma.hotel.deleteMany({ where: { id: { in: ids } } });
    const destinations = await prisma.destination.findMany({
      where: { slug: { startsWith: PREFIX } },
    });
    await prisma.auditEvent.deleteMany({
      where: { entityType: "destination", entityId: { in: destinations.map(({ id }) => id) } },
    });
    await prisma.destination.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  }

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
    admin = `Bearer ${await mint("local:admin")}`;
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const upload = (body: string | Buffer, options: UploadOptions = {}) => {
    const call = http()
      .post(ROUTE)
      .query({ dryRun: String(options.dryRun ?? false) })
      .set("Content-Type", options.type ?? "application/octet-stream");
    const auth = options.auth === undefined ? admin : options.auth;
    return (auth === null ? call : call.set("Authorization", auth)).send(
      typeof body === "string" ? Buffer.from(body) : body,
    );
  };
  const stored = (slug: string) => prisma.hotel.findUniqueOrThrow({ where: { slug } });

  it("dry-runs a per-row report and writes no hotel", async () => {
    const res = await upload(
      csv(KEPT, `${COAST},E2E CSV Second,${PREFIX}second,,,,,Synthetic Town,2,`),
      {
        dryRun: true,
      },
    ).expect(200);
    expect(res.body.data).toMatchObject({
      dryRun: true,
      applied: false,
      created: 2,
      destinationsCreated: 1,
    });
    expect(res.body.data.rows).toEqual([
      {
        line: 2,
        slug: `${PREFIX}kept`,
        outcome: "create",
        changedFields: ["destinationSlug", "name"],
      },
      {
        line: 3,
        slug: `${PREFIX}second`,
        outcome: "create",
        changedFields: ["destinationSlug", "name", "city", "minNights"],
      },
    ]);
    expect(await prisma.hotel.count({ where: { slug: { startsWith: PREFIX } } })).toBe(0);
    const job = await prisma.importJob.findUniqueOrThrow({
      where: { id: res.body.data.importJobId },
    });
    expect(job.status).toBe("validating");
    expect(job.errorReportJson).toMatchObject({ dryRun: true, created: 2 });
  });

  it("creates a draft hidden from the demo and the showcase, then lists the fields a change touches", async () => {
    await upload(csv(KEPT)).expect(200);
    expect(await stored(`${PREFIX}kept`)).toMatchObject({
      status: "draft",
      demoVisible: false,
      publicShowcase: false,
    });
    // The destination the file named was created on the way, audited as the destinations route would.
    const coast = await prisma.destination.findUniqueOrThrow({ where: { slug: COAST } });
    const created = await prisma.auditEvent.findFirstOrThrow({
      where: { entityType: "destination", entityId: coast.id, action: "create" },
    });
    expect(created.afterJson).toMatchObject({ slug: COAST, source: "import" });
    const res = await upload(csv(`${COAST},E2E CSV Kept,${PREFIX}kept,,,,,Synthetic Town,3,`), {
      dryRun: true,
    }).expect(200);
    expect(res.body.data).toMatchObject({ created: 0, updated: 1 });
    expect(res.body.data.rows[0]).toMatchObject({
      outcome: "update",
      changedFields: ["city", "minNights"],
    });
  });

  it("keeps a staff edit, its status and its flags when a re-import leaves those cells blank", async () => {
    const hotel = await stored(`${PREFIX}kept`);
    const edit = {
      brand: "Synthetic Collection",
      status: "active",
      demoVisible: true,
      publicShowcase: true,
      city: "Synthetic Town",
      minNights: 2,
      internalNotes: "Synthetic internal note",
    };
    await http()
      .patch(`/hotels-admin/hotels/${hotel.id}`)
      .set("Authorization", admin)
      .send(edit)
      .expect(200);
    const res = await upload(csv(KEPT)).expect(200);
    // A real run that wrote nothing answers applied: false; the staff app then says "Nothing imported".
    expect(res.body.data).toMatchObject({ applied: false, unchanged: 1, updated: 0 });
    expect(await stored(`${PREFIX}kept`)).toMatchObject(edit);
    const updates = await prisma.auditEvent.count({
      where: { entityType: "hotel", entityId: hotel.id, action: "update" },
    });
    expect(updates).toBe(1); // the staff edit; the unchanged import row wrote nothing
  });

  it("reports a deleted hotel's web address as a row error while the other rows apply", async () => {
    await upload(csv(`${COAST},E2E CSV Gone,${PREFIX}gone,,,,,,,`)).expect(200);
    const gone = await stored(`${PREFIX}gone`);
    await http().delete(`/hotels-admin/hotels/${gone.id}`).set("Authorization", admin).expect(200);
    const res = await upload(
      csv(
        `${COAST},E2E CSV North,${PREFIX}north,,,,,,,`,
        `${COAST},E2E CSV Gone Again,${PREFIX}gone,,,,,,,`,
        `${COAST},E2E CSV South,${PREFIX}south,,,,,,,`,
      ),
    ).expect(200);
    expect(res.body.data).toMatchObject({ applied: true, created: 2 });
    expect(res.body.data.rejected).toEqual([
      { line: 3, errors: [{ field: "slug", message: expect.stringMatching(/deleted hotel/) }] },
    ]);
    expect(await prisma.hotel.count({ where: { slug: `${PREFIX}gone` } })).toBe(1);
    expect(
      await prisma.hotel.count({ where: { slug: { in: [`${PREFIX}north`, `${PREFIX}south`] } } }),
    ).toBe(2);
  });

  it("refuses a file over 5 MiB with 413, a JSON body with 415 and an unknown header with 400", async () => {
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1, "a");
    const tooLarge = await upload(oversized).expect(413);
    expect(tooLarge.body.error.code).toBe("payload_too_large");
    const json = await http()
      .post(ROUTE)
      .set("Authorization", admin)
      .send({ content: csv(KEPT) })
      .expect(415);
    expect(json.body.error.code).toBe("unsupported_media_type");
    const unknown = await upload("destinationSlug,name,mystery\nx,y,z").expect(400);
    expect(unknown.body.error).toMatchObject({
      code: "validation_failed",
      details: [{ path: "file", message: expect.stringMatching(/Unknown column\(s\): mystery/) }],
    });
  });

  it("takes a file well over the old 100 KB JSON cap, read as the raw file", async () => {
    const notes = "x".repeat(9_000);
    const rows = Array.from(
      { length: 15 },
      (_, i) => `${COAST},E2E CSV Big ${i},${PREFIX}big-${i},${notes}`,
    );
    const body = ["destinationSlug,name,slug,accessNotes", ...rows].join("\n");
    expect(Buffer.byteLength(body)).toBeGreaterThan(130 * 1024);
    const res = await upload(body, { dryRun: true }).expect(200);
    expect(res.body.data).toMatchObject({ dryRun: true, created: 15, rejected: [] });
    expect(await prisma.hotel.count({ where: { slug: { startsWith: `${PREFIX}big-` } } })).toBe(0);
  });

  it("answers an anonymous upload 401, not 415: the body waits for the guards", async () => {
    const res = await upload(csv(KEPT), { auth: null }).expect(401);
    expect(res.body.error.code).toBe("unauthenticated");
  });

  it("refuses a staff member without the import key before reading the file", async () => {
    await upload(csv(KEPT), { auth: `Bearer ${await mint("local:cd")}` }).expect(403);
  });

  it("takes text/csv with a UTF-8 byte-order mark, as Excel saves it", async () => {
    const res = await upload(`\uFEFF${csv(KEPT)}`, {
      type: "text/csv; charset=utf-8",
      dryRun: true,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.rows[0]).toMatchObject({ slug: `${PREFIX}kept`, outcome: "unchanged" });
  });
});
