import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { importCalls } from "./hotel-import-calls.js";
import { startApi } from "./start-api.js";

/** Every fixture's web address and destination carries this prefix, so the suite cleans up after itself. */
const PREFIX = "e2e-rateimp-";
const HOTEL = `${PREFIX}hotel`;
const OTHER = `${PREFIX}other`;
const CARD = "E2E Rateimp Season 2027";
const SUITE = "E2E Rateimp Lake Suite";
const LAWN = "E2E Rateimp Lawn";
const HEADER =
  "hotelSlug,cardName,validFrom,validTo,itemType,roomName,venueName,amount,amountMax,unit,minQuantity,isIndicative,inclusions";
const file = (...rows: string[]) => [HEADER, ...rows].join("\n");
const SEASON = [
  `${HOTEL},${CARD},2027-04-01,2028-03-31,Room rate,${SUITE},,"12,500",15000,per night,,,Breakfast for two`,
  `${HOTEL},e2e rateimp  SEASON 2027,,,Per plate veg,,,1800.50,,per plate,150,no,`,
  `${HOTEL},${CARD},,,Venue rental,,${LAWN},"2,50,000",,per event,,,`,
];

/**
 * The Rates import end to end (Module C; plan §4.8, Slice 4; D-170, D-184): a file names its hotel by web
 * address, its rate card by name and each item by type, room and venue; the preview writes nothing but its
 * job, and importing it by its job id creates a DRAFT card with HIDDEN items, each audited by the fields it
 * sets. Re-importing changes nothing, a blank never clears, rates never go into a verified card, a room
 * must be the hotel's own, and only the uploader imports a preview, once. All fixtures are synthetic.
 */
describe("Rates import (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;
  let prisma: PrismaService;
  let admin = "";
  let hotelId = "";
  let imports: ReturnType<typeof importCalls>;

  async function removeFixtures(): Promise<void> {
    const hotels = await prisma.hotel.findMany({ where: { slug: { startsWith: PREFIX } } });
    const ids = hotels.map((hotel) => hotel.id);
    const cards = await prisma.hotelRateCard.findMany({ where: { hotelId: { in: ids } } });
    const cardIds = cards.map(({ id }) => id);
    const items = await prisma.hotelRateItem.findMany({ where: { rateCardId: { in: cardIds } } });
    const rooms = await prisma.hotelRoomCategory.findMany({ where: { hotelId: { in: ids } } });
    const venues = await prisma.hotelVenue.findMany({ where: { hotelId: { in: ids } } });
    const checks = await prisma.hotelVerification.findMany({ where: { hotelId: { in: ids } } });
    const children = [...cards, ...items, ...rooms, ...venues, ...checks].map(({ id }) => id);
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: [...ids, ...children] } } });
    await prisma.hotelRateItem.deleteMany({ where: { rateCardId: { in: cardIds } } });
    await prisma.hotelRateCard.deleteMany({ where: { hotelId: { in: ids } } });
    await prisma.hotelVerification.deleteMany({ where: { hotelId: { in: ids } } });
    await prisma.hotelRoomCategory.deleteMany({ where: { hotelId: { in: ids } } });
    await prisma.hotelVenue.deleteMany({ where: { hotelId: { in: ids } } });
    await prisma.hotel.deleteMany({ where: { id: { in: ids } } });
    await prisma.destination.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  }

  const http = () => request(app.getHttpServer());
  const post = (path: string, body: object) =>
    http().post(path).set("Authorization", admin).send(body).expect(201);
  const cardOf = (name: string) =>
    prisma.hotelRateCard.findFirst({
      where: { hotelId, name, deletedAt: null },
      include: { items: { orderBy: { itemType: "asc" } } },
    });

  async function createHotel(destinationId: string, slug: string, room: string): Promise<string> {
    const hotel = await post("/hotels-admin/hotels", {
      destinationId,
      name: `E2E Rateimp ${slug}`,
      slug,
      status: "active",
    });
    await post(`/hotels-admin/hotels/${hotel.body.data.id}/rooms`, { name: room, roomCount: 8 });
    return hotel.body.data.id;
  }

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    imports = importCalls(app);
    await removeFixtures();
    admin = `Bearer ${await mint("local:admin")}`;
    const destination = await post("/hotels-admin/destinations", {
      name: "E2E Rateimp Bay",
      slug: `${PREFIX}bay`,
    });
    hotelId = await createHotel(destination.body.data.id, HOTEL, SUITE);
    await post(`/hotels-admin/hotels/${hotelId}/venues`, {
      name: LAWN,
      venueType: "lawn",
      setting: "outdoor",
    });
    await createHotel(destination.body.data.id, OTHER, "E2E Rateimp Other Suite");
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  it("previews a rates file writing nothing, then imports it: one draft card, hidden items", async () => {
    const preview = await imports.preview(admin, "rates", file(...SEASON)).expect(200);
    expect(preview.body.data).toMatchObject({ kind: "rates", dryRun: true, created: 3 });
    expect(preview.body.data.rows[0]).toEqual({
      line: 2,
      slug: HOTEL,
      name: CARD,
      outcome: "create",
      changedFields: [
        "cardName",
        "validFrom",
        "validTo",
        "itemType",
        "roomName",
        "amount",
        "amountMax",
        "unit",
        "inclusions",
      ],
      item: { itemType: "room_rate", roomName: SUITE, venueName: null },
    });
    expect(await cardOf(CARD)).toBeNull();
    const jobId: string = preview.body.data.importJobId;
    const job = await prisma.importJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(job).toMatchObject({ importType: "hotel_rates", status: "validating" });

    const res = await imports.apply(admin, "rates", jobId).expect(200);
    expect(res.body.data).toMatchObject({ importJobId: jobId, applied: true, created: 3 });
    const card = await cardOf(CARD);
    expect(card).toMatchObject({ status: "draft", currency: "INR", verificationId: null });
    expect(card?.validFrom?.toISOString().slice(0, 10)).toBe("2027-04-01");
    expect(
      card?.items.map((item) => [item.itemType, item.amount.toFixed(2), item.clientVisible]),
    ).toEqual([
      ["room_rate", "12500.00", false],
      ["venue_rental", "250000.00", false],
      ["per_plate_veg", "1800.50", false],
    ]);
    expect(card?.items.map((item) => item.isIndicative)).toEqual([true, true, false]);
    expect(card?.items[2]?.minQuantity).toBe(150);
  });

  it("audits the card and each item by the fields set, never their values", async () => {
    const card = await cardOf(CARD);
    const ids = [card?.id ?? "", ...(card?.items ?? []).map(({ id }) => id)];
    const events = await prisma.auditEvent.findMany({ where: { entityId: { in: ids } } });
    expect(events.map(({ entityType, action }) => [entityType, action]).sort()).toEqual([
      ["hotel_rate_card", "create"],
      ["hotel_rate_item", "create"],
      ["hotel_rate_item", "create"],
      ["hotel_rate_item", "create"],
    ]);
    const images = JSON.stringify(events.map(({ afterJson }) => afterJson));
    expect(images).toContain('"source":"import"');
    // Field names only: no amount, no inclusions, no money object reaches an image.
    expect(images).not.toMatch(/"(amount|amountMax|minor|inclusionsText)":|Breakfast/);
  });

  it("re-imports the same file unchanged, then changes one amount; a blank never clears", async () => {
    const again = await imports.previewAndApply(admin, "rates", file(...SEASON));
    expect(again.body.data).toMatchObject({ applied: false, created: 0, updated: 0, unchanged: 3 });
    const change = `${HOTEL},${CARD},,,Room rate,${SUITE},,13000,,,,,`;
    const changed = await imports.previewAndApply(admin, "rates", file(change));
    expect(changed.body.data).toMatchObject({ updated: 1 });
    expect(changed.body.data.rows[0]).toMatchObject({
      outcome: "update",
      changedFields: ["amount"],
    });
    const suite = (await cardOf(CARD))?.items.find(({ itemType }) => itemType === "room_rate");
    expect(suite).toMatchObject({ inclusionsText: "Breakfast for two", clientVisible: false });
    expect([suite?.amount.toFixed(2), suite?.amountMax?.toFixed(2)]).toEqual([
      "13000.00",
      "15000.00",
    ]);
  });

  it("refuses rows into a verified card and for a second hotel's room, applying the others", async () => {
    const card = await cardOf(CARD);
    const check = await post(`/hotels-admin/hotels/${hotelId}/verifications`, {
      fieldGroup: "rates",
      source: "email",
    });
    await http()
      .post(`/hotels-admin/hotels/${hotelId}/rate-cards/${card?.id}/verify`)
      .set("Authorization", admin)
      .send({ verificationId: check.body.data.id })
      .expect(200);
    const res = await imports.previewAndApply(
      admin,
      "rates",
      file(
        `${HOTEL},${CARD},,,Tax,,,18,,percent,,,`,
        `${HOTEL},E2E Rateimp Season 2028,,,Room rate,E2E Rateimp Other Suite,,9000,,per night,,,`,
        `${HOTEL},E2E Rateimp Season 2028,2028-04-01,,Tax,,,18,,percent,,,`,
      ),
    );
    expect(res.body.data).toMatchObject({ created: 1 });
    expect(res.body.data.rejected).toEqual([
      {
        line: 2,
        errors: [
          {
            field: "cardName",
            message:
              "Rates are imported only into draft cards, and this card is verified; give the file a new card name",
          },
        ],
      },
      {
        line: 3,
        errors: [{ field: "roomName", message: "No room named E2E Rateimp Other Suite" }],
      },
    ]);
    expect((await cardOf(CARD))?.items).toHaveLength(3);
    expect(await cardOf("E2E Rateimp Season 2028")).toMatchObject({ status: "draft" });
  });

  it("answers 404 to another member of staff and 409 to a second import", async () => {
    const preview = await imports
      .preview(admin, "rates", file(`${HOTEL},E2E Rateimp Season 2029,,,Tax,,,18,,percent,,,`))
      .expect(200);
    const jobId: string = preview.body.data.importJobId;
    await imports.apply(`Bearer ${await mint("local:ht")}`, "rates", jobId).expect(404);
    await imports.apply(admin, "rooms", jobId).expect(404);
    await imports.apply(admin, "rates", jobId).expect(200);
    const again = await imports.apply(admin, "rates", jobId).expect(409);
    expect(again.body.error.message).toBe("This preview was already imported");
  });

  it("holds the kind to its key and refuses a query, before reading the file", async () => {
    const row = file(`${HOTEL},E2E Rateimp X,,,Tax,,,18,,percent,,,`);
    await imports.preview(null, "rates", row).expect(401);
    // Sales reads rate cards but may not create them; a Creative Director has no rates key at all,
    // so the route is as absent to them as a missing one.
    await imports.preview(`Bearer ${await mint("local:sm")}`, "rates", row).expect(403);
    await imports.preview(`Bearer ${await mint("local:cd")}`, "rates", row).expect(404);
    await http()
      .post("/hotels-admin/imports/rates")
      .query({ dryRun: "true" })
      .set("Authorization", admin)
      .set("Content-Type", "application/octet-stream")
      .send(Buffer.from(row))
      .expect(400);
  });
});
