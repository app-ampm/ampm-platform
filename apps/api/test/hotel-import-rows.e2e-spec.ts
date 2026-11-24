import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { HotelsService } from "../src/modules/hotels/hotels.service.js";
import { fakeEntitlements, fakePrincipal } from "./discovery-principals.js";
import { importCalls } from "./hotel-import-calls.js";
import { startApi } from "./start-api.js";

/** Every fixture's web address and destination carries this prefix, so the suite cleans up after itself. */
const PREFIX = "e2e-rowimp-";
const HOTEL = `${PREFIX}hotel`;
const ROOMS =
  "hotelSlug,name,roomCount,unitType,viewLabel,maxOccupancy,sizeSqm,sizeSqft,facilities";
const VENUES =
  "hotelSlug,name,venueType,setting,areaSqft,lengthM,capacityBanquet,capacityReception,otherLayouts,capacityNotes";
const file = (header: string, ...rows: string[]) => [header, ...rows].join("\n");

/**
 * The Rooms and Venues imports end to end (Module C; plan §4.8, Slice 3; D-181): a file names its hotel by
 * web address and each room or venue by name; the preview writes nothing but its job, and importing it by
 * its job id writes the rows with no file sent again, each audited. Names match within the hotel ignoring
 * case and spacing, a blank cell never clears, nothing is deleted, a refused row never stops the others, a
 * venue's setting decides is_indoor, and each kind is held to its own key with the body read only after
 * the guards. All fixtures are synthetic.
 */
describe("Rooms and venues import (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;
  let prisma: PrismaService;
  let admin = "";
  let hotelId = "";
  let imports: ReturnType<typeof importCalls>;

  async function removeFixtures(): Promise<void> {
    const hotels = await prisma.hotel.findMany({ where: { slug: { startsWith: PREFIX } } });
    const ids = hotels.map((hotel) => hotel.id);
    const rooms = await prisma.hotelRoomCategory.findMany({ where: { hotelId: { in: ids } } });
    const venues = await prisma.hotelVenue.findMany({ where: { hotelId: { in: ids } } });
    const entityIds = [...ids, ...rooms.map(({ id }) => id), ...venues.map(({ id }) => id)];
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: entityIds } } });
    await prisma.hotelRoomCategory.deleteMany({ where: { hotelId: { in: ids } } });
    await prisma.hotelVenue.deleteMany({ where: { hotelId: { in: ids } } });
    await prisma.hotel.deleteMany({ where: { id: { in: ids } } });
    await prisma.destination.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  }

  const http = () => request(app.getHttpServer());
  const roomsOf = () =>
    prisma.hotelRoomCategory.findMany({
      where: { hotelId, deletedAt: null },
      orderBy: { name: "asc" },
    });

  async function createHotel(destinationId: string, slug: string): Promise<string> {
    const res = await http()
      .post("/hotels-admin/hotels")
      .set("Authorization", admin)
      .send({ destinationId, name: `E2E Rowimp ${slug}`, slug, status: "active" })
      .expect(201);
    return res.body.data.id;
  }

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    imports = importCalls(app);
    await removeFixtures();
    admin = `Bearer ${await mint("local:admin")}`;
    const destination = await http()
      .post("/hotels-admin/destinations")
      .set("Authorization", admin)
      .send({ name: "E2E Rowimp Hills", slug: `${PREFIX}hills` })
      .expect(201);
    hotelId = await createHotel(destination.body.data.id, HOTEL);
    const gone = await createHotel(destination.body.data.id, `${PREFIX}gone`);
    await http().delete(`/hotels-admin/hotels/${gone}`).set("Authorization", admin).expect(200);
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  it("previews a rooms file without writing a room, then imports it by its job id with no file", async () => {
    const rooms = file(
      ROOMS,
      `${HOTEL},E2E Rowimp Lake Suite,12,Suite,Lake view,3,,650,Balcony|Bath tub`,
      `${HOTEL},E2E Rowimp Garden Room,30,room,,2,32,,`,
    );
    const preview = await imports.preview(admin, "rooms", rooms).expect(200);
    expect(preview.body.data).toMatchObject({ kind: "rooms", dryRun: true, created: 2 });
    expect(await roomsOf()).toEqual([]);
    const jobId: string = preview.body.data.importJobId;
    const job = await prisma.importJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(job).toMatchObject({ importType: "hotel_rooms", status: "validating" });
    // The import takes no file: an empty body.
    const res = await http()
      .post(`/hotels-admin/imports/rooms/${jobId}/apply`)
      .set("Authorization", admin)
      .expect(200);
    expect(res.body.data).toMatchObject({
      importJobId: jobId,
      kind: "rooms",
      applied: true,
      created: 2,
    });
    expect(await roomsOf()).toMatchObject([
      {
        name: "E2E Rowimp Garden Room",
        roomCount: 30,
        sizeSqm: 32,
        sizeSqft: null,
        unitType: "room",
      },
      {
        name: "E2E Rowimp Lake Suite",
        sizeSqft: 650,
        sizeSqm: 60,
        unitType: "suite",
        facilities: ["Balcony", "Bath tub"],
      },
    ]);
    expect(await prisma.importJob.findUniqueOrThrow({ where: { id: jobId } })).toMatchObject({
      status: "applied",
      planJson: null,
    });
    const audited = await prisma.auditEvent.findMany({
      where: {
        entityType: "hotel_room_category",
        action: "create",
        entityId: { in: (await roomsOf()).map(({ id }) => id) },
      },
    });
    expect(audited.map((event) => event.afterJson)).toEqual([
      expect.objectContaining({ source: "import", importJobId: jobId, hotelId }),
      expect.objectContaining({ source: "import", importJobId: jobId, hotelId }),
    ]);
  });

  it("matches a room by name within its hotel, ignoring case and spacing; a blank never clears; nothing is deleted", async () => {
    const res = await imports.previewAndApply(
      admin,
      "rooms",
      file(ROOMS, `${HOTEL},  e2e rowimp LAKE   suite ,14,,,,,,`),
    );
    expect(res.body.data).toMatchObject({ created: 0, updated: 1 });
    expect(res.body.data.rows[0]).toMatchObject({
      name: "E2E Rowimp Lake Suite",
      changedFields: ["roomCount"],
    });
    expect(await roomsOf()).toMatchObject([
      { name: "E2E Rowimp Garden Room", roomCount: 30 },
      {
        name: "E2E Rowimp Lake Suite",
        roomCount: 14,
        viewLabel: "Lake view",
        maxOccupancy: 3,
        sizeSqft: 650,
      },
    ]);
  });

  it("refuses rows by line while the others apply: no hotel, a deleted one, a repeated name, occupancy 0", async () => {
    const res = await imports.previewAndApply(
      admin,
      "rooms",
      file(
        ROOMS,
        `${PREFIX}nowhere,E2E Rowimp Lost Room,1,,,,,,`,
        `${PREFIX}gone,E2E Rowimp Gone Room,1,,,,,,`,
        `${HOTEL},E2E Rowimp Twin,4,,,,,,`,
        `${HOTEL},e2e rowimp twin,5,,,,,,`,
        `${HOTEL},E2E Rowimp Cosy Room,2,,,0,,,`,
      ),
    );
    expect(res.body.data).toMatchObject({ created: 1, totalRows: 5 });
    expect(res.body.data.rejected).toEqual([
      { line: 2, errors: [expect.objectContaining({ field: "hotelSlug" })] },
      { line: 3, errors: [{ field: "hotelSlug", message: "This hotel was deleted" }] },
      {
        line: 5,
        errors: [{ field: "name", message: "Line 4 already names this room for this hotel" }],
      },
      { line: 6, errors: [expect.objectContaining({ field: "maxOccupancy" })] },
    ]);
  });

  it("imports venues: the setting decides is_indoor, layouts and capacities read, metres kept", async () => {
    const res = await imports.previewAndApply(
      admin,
      "venues",
      file(
        VENUES,
        `${HOTEL},E2E Rowimp Terrace,Terrace,Semi-open,5000,30.5,300,450,Classroom: 120 | U-shape: 30-40,400 to 450 standing`,
        `${HOTEL},E2E Rowimp Hall,Meeting room,indoor,,,80,,,`,
      ),
    );
    expect(res.body.data).toMatchObject({ kind: "venues", created: 2 });
    const terrace = await prisma.hotelVenue.findFirstOrThrow({
      where: { hotelId, name: "E2E Rowimp Terrace" },
    });
    expect(terrace).toMatchObject({
      venueType: "terrace",
      setting: "semi_open",
      isIndoor: false,
      areaSqm: 465,
    });
    expect(terrace.lengthM?.toNumber()).toBe(30.5);
    expect(terrace.otherLayouts).toEqual([
      { layout: "Classroom", max: 120 },
      { layout: "U-shape", max: 40, min: 30 },
    ]);
    const hall = await prisma.hotelVenue.findFirstOrThrow({
      where: { hotelId, name: "E2E Rowimp Hall" },
    });
    expect(hall).toMatchObject({ venueType: "meeting_room", setting: "indoor", isIndoor: true });
  });

  it("refuses a new venue without its type and setting, a capacity range and an unreadable layouts cell", async () => {
    const res = await imports
      .preview(
        admin,
        "venues",
        file(
          VENUES,
          `${HOTEL},E2E Rowimp Lawn,,,,,,,,`,
          `${HOTEL},E2E Rowimp Deck,lawn,outdoor,,,600-700,,,`,
          `${HOTEL},E2E Rowimp Court,courtyard,outdoor,,,,,Classroom 120,`,
        ),
      )
      .expect(200);
    expect(res.body.data.rejected).toEqual([
      {
        line: 2,
        errors: [
          expect.objectContaining({ field: "venueType" }),
          expect.objectContaining({ field: "setting" }),
        ],
      },
      { line: 3, errors: [expect.objectContaining({ field: "capacityBanquet" })] },
      { line: 4, errors: [expect.objectContaining({ field: "otherLayouts" })] },
    ]);
  });

  it("shows a client the imported venue's new type, and none of the new room or venue fields", async () => {
    const detail = await app
      .get(HotelsService)
      .get(fakePrincipal("client", fakeEntitlements("all_hotels", false)), hotelId);
    expect(detail.venues.map((venue) => venue.venueType).sort()).toEqual([
      "meeting_room",
      "terrace",
    ]);
    for (const field of ["setting", "areaSqft", "lengthM", "otherLayouts", "capacityNotes"]) {
      for (const venue of detail.venues) expect(venue).not.toHaveProperty(field);
    }
    for (const field of ["unitType", "viewLabel", "sizeSqft"]) {
      for (const room of detail.rooms) expect(room).not.toHaveProperty(field);
    }
  });

  it("answers an anonymous rooms or venues upload 401 before reading the file", async () => {
    for (const kind of ["rooms", "venues"] as const) {
      const res = await imports
        .preview(null, kind, file(ROOMS, `${HOTEL},E2E Rowimp X,1,,,,,,`))
        .expect(401);
      expect(res.body.error.code).toBe("unauthenticated");
    }
  });

  it("holds each kind to its own key: a reader of rooms and venues may not import them", async () => {
    const creative = `Bearer ${await mint("local:cd")}`;
    await imports
      .preview(creative, "rooms", file(ROOMS, `${HOTEL},E2E Rowimp X,1,,,,,,`))
      .expect(403);
    await imports
      .preview(creative, "venues", file(VENUES, `${HOTEL},E2E Rowimp Y,lawn,outdoor,,,,,,`))
      .expect(403);
  });
});
