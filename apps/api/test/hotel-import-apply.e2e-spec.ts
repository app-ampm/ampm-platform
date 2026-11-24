import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { importCalls } from "./hotel-import-calls.js";
import { startApi } from "./start-api.js";

/** Every fixture's web address and destination carries this prefix, so the suite cleans up after itself. */
const PREFIX = "e2e-applyimp-";
const HOTEL = `${PREFIX}hotel`;
const ROOMS = "hotelSlug,name,roomCount";
const ROOM = "E2E Applyimp Suite";
const CHANGED = "Changed since preview; validate the file again";
const file = (header: string, ...rows: string[]) => [header, ...rows].join("\n");

/**
 * Importing a preview by its job id (Module C; plan §4.8; D-181): only the uploader may import it, once,
 * within a day, and only their newest preview of the kind; otherwise 404 (not theirs, another kind) or 409
 * (imported, expired, replaced). Each stored row is re-planned against the catalogue as it is then: a row
 * whose room or hotel a staff edit changed since its preview is refused while the others apply, but
 * recording a verification, which changes no compared field, refuses nothing. All fixtures are synthetic.
 */
describe("Importing an import preview (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;
  let prisma: PrismaService;
  let admin = "";
  let hotelId = "";
  let roomId = "";
  let imports: ReturnType<typeof importCalls>;

  async function removeFixtures(): Promise<void> {
    const hotels = await prisma.hotel.findMany({ where: { slug: { startsWith: PREFIX } } });
    const ids = hotels.map((hotel) => hotel.id);
    const rooms = await prisma.hotelRoomCategory.findMany({ where: { hotelId: { in: ids } } });
    const checks = await prisma.hotelVerification.findMany({ where: { hotelId: { in: ids } } });
    const children = [...rooms, ...checks].map(({ id }) => id);
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: [...ids, ...children] } } });
    await prisma.hotelVerification.deleteMany({ where: { hotelId: { in: ids } } });
    await prisma.hotelRoomCategory.deleteMany({ where: { hotelId: { in: ids } } });
    await prisma.hotel.deleteMany({ where: { id: { in: ids } } });
    await prisma.destination.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  }

  const http = () => request(app.getHttpServer());
  /** Previews a rooms file as the Super Admin; answers its job id. */
  const preview = async (body: string): Promise<string> => {
    const res = await imports.preview(admin, "rooms", body).expect(200);
    return res.body.data.importJobId;
  };

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    imports = importCalls(app);
    await removeFixtures();
    admin = `Bearer ${await mint("local:admin")}`;
    const destination = await http()
      .post("/hotels-admin/destinations")
      .set("Authorization", admin)
      .send({ name: "E2E Applyimp Bay", slug: `${PREFIX}bay` })
      .expect(201);
    const hotel = await http()
      .post("/hotels-admin/hotels")
      .set("Authorization", admin)
      .send({ destinationId: destination.body.data.id, name: "E2E Applyimp Hotel", slug: HOTEL })
      .expect(201);
    hotelId = hotel.body.data.id;
    const room = await http()
      .post(`/hotels-admin/hotels/${hotelId}/rooms`)
      .set("Authorization", admin)
      .send({ name: ROOM, roomCount: 10 })
      .expect(201);
    roomId = room.body.data.id;
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  it("answers 404 to another member of staff and for another kind, and imports for the uploader", async () => {
    const jobId = await preview(file(ROOMS, `${HOTEL},${ROOM},11`));
    const hotelTeam = `Bearer ${await mint("local:ht")}`;
    await imports.apply(hotelTeam, "rooms", jobId).expect(404);
    await imports.apply(admin, "venues", jobId).expect(404);
    await http()
      .post(`/hotels-admin/imports/rooms/${jobId}/apply`)
      .set("Authorization", admin)
      .send({ csv: "not taken" })
      .expect(400);
    const res = await imports.apply(admin, "rooms", jobId).expect(200);
    expect(res.body.data).toMatchObject({ importJobId: jobId, updated: 1 });
  });

  it("answers 409 to a second import of the same preview", async () => {
    const jobId = await preview(file(ROOMS, `${HOTEL},${ROOM},12`));
    await imports.apply(admin, "rooms", jobId).expect(200);
    const again = await imports.apply(admin, "rooms", jobId).expect(409);
    expect(again.body.error.message).toBe("This preview was already imported");
  });

  it("answers 409 to a preview over a day old, and to one a newer preview replaced", async () => {
    const old = await preview(file(ROOMS, `${HOTEL},${ROOM},13`));
    await prisma.importJob.update({
      where: { id: old },
      data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });
    const expired = await imports.apply(admin, "rooms", old).expect(409);
    expect(expired.body.error.message).toBe("This preview has expired; validate the file again");
    const replaced = await preview(file(ROOMS, `${HOTEL},${ROOM},13`));
    const newest = await preview(file(ROOMS, `${HOTEL},${ROOM},14`));
    expect(await prisma.importJob.findUniqueOrThrow({ where: { id: replaced } })).toMatchObject({
      status: "validating",
      planJson: null,
    });
    await imports.apply(admin, "rooms", replaced).expect(409);
    await imports.apply(admin, "rooms", newest).expect(200);
    const stored = await prisma.hotelRoomCategory.findUniqueOrThrow({ where: { id: roomId } });
    expect(stored.roomCount).toBe(14);
  });

  it("refuses a row whose room a staff edit changed since the preview, applying the others", async () => {
    const jobId = await preview(
      file(ROOMS, `${HOTEL},${ROOM},20`, `${HOTEL},E2E Applyimp Villa,2`),
    );
    await http()
      .patch(`/hotels-admin/hotels/${hotelId}/rooms/${roomId}`)
      .set("Authorization", admin)
      .send({ viewLabel: "Synthetic garden view" })
      .expect(200);
    const res = await imports.apply(admin, "rooms", jobId).expect(200);
    expect(res.body.data).toMatchObject({ created: 1, updated: 0 });
    expect(res.body.data.rejected).toEqual([
      { line: 2, errors: [{ field: "row", message: CHANGED }] },
    ]);
    const stored = await prisma.hotelRoomCategory.findUniqueOrThrow({ where: { id: roomId } });
    expect(stored).toMatchObject({ roomCount: 14, viewLabel: "Synthetic garden view" });
  });

  it("refuses a hotels row after a staff edit of the hotel, but not after a verification is recorded", async () => {
    const hotels = (city: string) =>
      file("destinationSlug,name,slug,city", `${PREFIX}bay,E2E Applyimp Hotel,${HOTEL},${city}`);
    const first = await imports.preview(admin, "hotels", hotels("Synthetic Town")).expect(200);
    await http()
      .post(`/hotels-admin/hotels/${hotelId}/verifications`)
      .set("Authorization", admin)
      .send({ fieldGroup: "profile", source: "phone" })
      .expect(201);
    const verified = await imports.apply(admin, "hotels", first.body.data.importJobId).expect(200);
    expect(verified.body.data).toMatchObject({ updated: 1, rejected: [] });
    const second = await imports.preview(admin, "hotels", hotels("Synthetic City")).expect(200);
    await http()
      .patch(`/hotels-admin/hotels/${hotelId}`)
      .set("Authorization", admin)
      .send({ minNights: 2 })
      .expect(200);
    const edited = await imports.apply(admin, "hotels", second.body.data.importJobId).expect(200);
    expect(edited.body.data.rejected).toEqual([
      { line: 2, errors: [{ field: "row", message: CHANGED }] },
    ]);
    expect(await prisma.hotel.findUniqueOrThrow({ where: { id: hotelId } })).toMatchObject({
      city: "Synthetic Town",
      minNights: 2,
    });
  });
});
