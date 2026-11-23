import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { HotelsService } from "../src/modules/hotels/hotels.service.js";
import { fakeEntitlements, fakePrincipal } from "./discovery-principals.js";
import { startApi } from "./start-api.js";

/** Every fixture's web address and destination carries this prefix, so the suite cleans up after itself. */
const PREFIX = "e2e-catalogue-";
const INTERNAL = {
  nameAliases: ["E2E Catalogue Annexe"],
  weddingBuyoutPolicy: "depends",
  minRoomsWithoutBuyout: 40,
  minNights: 2,
  parallelFunctions: "not_allowed",
  bookingNotes: "Synthetic booking note",
} as const;
const LOCATION = {
  parentGroup: "Synthetic Hospitality Group",
  locality: "Synthetic Ghat",
  city: "Udaipur",
  state: "Rajasthan",
  postalCode: "313001",
  mapsUrl: "https://maps.app.goo.gl/SyntheticPin01",
  airportName: "Synthetic Airport",
  airportDistanceKm: 22.5,
  airportDriveMinutes: 40,
  cuisines: ["Indian", "Other"],
  servesAlcohol: true,
} as const;
const RESTRICTED = ["internalRating", "internalNotes", "contacts"] as const;

/**
 * The D-178 hotel fields end to end (Module C; plan §6.2). Staff write and read them round trip, decimals
 * as numbers and lists as lists; a PIN must fit an Indian destination and a cuisine must be configured;
 * Creative and Finance read the INTERNAL name variants and booking terms with the rest of the profile, never
 * the RESTRICTED notes; and the client hotel detail carries none of the new fields yet (Slice 12).
 */
describe("Hotel catalogue fields (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;
  let prisma: PrismaService;
  let admin = "";
  let destinationId = "";
  let hotelId = "";

  async function removeFixtures(): Promise<void> {
    const hotels = await prisma.hotel.findMany({ where: { slug: { startsWith: PREFIX } } });
    const destinations = await prisma.destination.findMany({
      where: { slug: { startsWith: PREFIX } },
    });
    const ids = [...hotels, ...destinations].map((row) => row.id);
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: ids } } });
    await prisma.hotel.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.destination.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  }

  const http = () => request(app.getHttpServer());
  const detail = async (subject: string): Promise<Record<string, unknown>> => {
    const res = await http()
      .get(`/hotels-admin/hotels/${hotelId}`)
      .set("Authorization", `Bearer ${await mint(subject)}`)
      .expect(200);
    return res.body.data;
  };
  const patch = (body: object) =>
    http().patch(`/hotels-admin/hotels/${hotelId}`).set("Authorization", admin).send(body);

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
    admin = `Bearer ${await mint("local:admin")}`;
    const destination = await http()
      .post("/hotels-admin/destinations")
      .set("Authorization", admin)
      .send({ name: "E2E Catalogue Lakes", slug: `${PREFIX}lakes` })
      .expect(201);
    destinationId = destination.body.data.id;
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  it("creates a hotel with the new fields and reads them back as written", async () => {
    const res = await http()
      .post("/hotels-admin/hotels")
      .set("Authorization", admin)
      .send({
        destinationId,
        name: "E2E Catalogue Hotel",
        slug: `${PREFIX}hotel`,
        status: "active",
        internalNotes: "Synthetic internal note",
        ...LOCATION,
        ...INTERNAL,
        cuisines: ["indian", "other"],
      })
      .expect(201);
    hotelId = res.body.data.id;
    expect(res.body.data).toMatchObject({ ...LOCATION, ...INTERNAL, railwayDistanceKm: null });
  });

  it("round-trips a PATCH: coordinates and distances at their scale, a null clearing a field", async () => {
    const res = await patch({
      latitude: 24.576123,
      longitude: 73.683456,
      cityCentreDistanceKm: 3.5,
      totalEventSpaceSqft: 12000,
      isPureVegetarian: false,
      bookingNotes: null,
    }).expect(200);
    expect(res.body.data).toMatchObject({
      latitude: 24.576123,
      longitude: 73.683456,
      cityCentreDistanceKm: 3.5,
      totalEventSpaceSqft: 12000,
      isPureVegetarian: false,
      bookingNotes: null,
      minNights: 2,
      city: "Udaipur",
    });
    expect(await detail("local:admin")).toMatchObject({
      bookingNotes: null,
      cityCentreDistanceKm: 3.5,
    });
  });

  it("refuses a PIN that breaks the India rule, an unknown cuisine and a non-Maps link, naming each", async () => {
    const pin = await patch({ postalCode: "013001" }).expect(400);
    expect(pin.body.error.details).toEqual([{ path: "postalCode", message: expect.any(String) }]);
    const cuisine = await patch({ cuisines: ["Indian", "Martian"] }).expect(400);
    expect(cuisine.body.error.details).toEqual([
      { path: "cuisines.1", message: expect.any(String) },
    ]);
    const maps = await patch({ mapsUrl: "https://www.google.com.evil.example/maps/x" }).expect(400);
    expect(maps.body.error.details).toEqual([expect.objectContaining({ path: "mapsUrl" })]);
    expect(await detail("local:admin")).toMatchObject({
      postalCode: "313001",
      cuisines: ["Indian", "Other"],
    });
  });

  it("takes a PIN as typed on a destination outside India, spaces removed", async () => {
    const abroad = await http()
      .post("/hotels-admin/destinations")
      .set("Authorization", admin)
      .send({ name: "E2E Catalogue Abroad", slug: `${PREFIX}abroad`, country: "Portugal" })
      .expect(201);
    const res = await patch({ destinationId: abroad.body.data.id, postalCode: "1100 148" }).expect(
      200,
    );
    expect(res.body.data).toMatchObject({
      destinationId: abroad.body.data.id,
      postalCode: "1100148",
    });
    await patch({ destinationId, postalCode: "313001" }).expect(200);
  });

  it("gives Creative and Finance the INTERNAL name variants and booking terms, never the notes", async () => {
    for (const subject of ["local:cd", "local:fa"]) {
      const hotel = await detail(subject);
      expect(hotel).toMatchObject({ ...INTERNAL, bookingNotes: null, mapsUrl: LOCATION.mapsUrl });
      for (const field of RESTRICTED) expect(hotel).not.toHaveProperty(field);
    }
  });

  it("serves the staff editor the configured cuisines and the label for anything else", async () => {
    const res = await http()
      .get("/hotels-admin/cuisine-options")
      .set("Authorization", `Bearer ${await mint("local:fa")}`)
      .expect(200);
    expect(res.body.data).toMatchObject({
      options: expect.arrayContaining(["Indian"]),
      other: "Other",
    });
  });

  it("keeps every new field off the client hotel detail", async () => {
    const client = fakePrincipal("client", fakeEntitlements("all_hotels", false));
    const hotel = await app.get(HotelsService).get(client, hotelId);
    expect(hotel.name).toBe("E2E Catalogue Hotel");
    for (const field of [
      "nameAliases",
      "bookingNotes",
      "mapsUrl",
      "postalCode",
      "minNights",
      "cuisines",
    ]) {
      expect(hotel).not.toHaveProperty(field);
    }
  });
});
