import type { HotelReach } from "@ampm/core";
import type { Entitlements } from "@ampm/policy";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { HotelsService } from "../src/modules/hotels/hotels.service.js";
import type { Principal } from "../src/policy/principal.types.js";
import { startApi } from "./start-api.js";

const TAG = "E2E-HotelDest";
const PREFIX = "e2e-hoteldest-";

function fakePrincipal(type: "client" | "demo", reach: HotelReach): Principal {
  const entitlements: Entitlements = {
    modules: ["hotel_discovery"],
    readOnlyModules: [],
    hotelReach: [reach],
    financeReach: [],
    requestTypes: { wedding: [], account: [] },
    signInRefused: false,
  };
  return {
    type,
    userId: "00000000-0000-7000-8000-000000000000",
    name: "T",
    email: null,
    phone: null,
    status: "active",
    lastLoginAt: null,
    memberships: [],
    entitlements,
  };
}

/**
 * Hotel discovery destinations browse end to end (Module C, feature 9.4b; CP-01/02, AC-04.5). A client sees
 * active destinations with their in-reach active-hotel counts: the count matches the catalogue the caller
 * can open (all active for a subscriber, only demo_visible for a demo prospect), inactive hotels are never
 * counted, a destination with no in-reach active hotels is absent, and a draft destination is absent even
 * when it has active hotels. Filtered to the synthetic PREFIX so the assertions ignore the baseline seed.
 */
describe("Hotel discovery destinations browse (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let hotels: HotelsService;

  async function removeFixtures(): Promise<void> {
    const rows = await prisma.hotel.findMany({
      where: { slug: { startsWith: PREFIX } },
      select: { id: true },
    });
    await prisma.hotel.deleteMany({ where: { id: { in: rows.map((h) => h.id) } } });
    await prisma.destination.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  }

  async function seedDest(slug: string, status: "active" | "draft"): Promise<string> {
    const row = await prisma.destination.create({
      data: { name: `${TAG} ${slug}`, slug: `${PREFIX}${slug}`, country: "India", status },
      select: { id: true },
    });
    return row.id;
  }

  async function seedHotel(
    destinationId: string,
    slug: string,
    opts: { active: boolean; demoVisible: boolean },
  ): Promise<void> {
    await prisma.hotel.create({
      data: {
        destinationId,
        name: `${TAG} ${slug}`,
        slug: `${PREFIX}${slug}`,
        descriptionClient: "A synthetic test hotel.",
        status: opts.active ? "active" : "inactive",
        demoVisible: opts.demoVisible,
      },
    });
  }

  beforeAll(async () => {
    ({ app } = await startApi());
    prisma = app.get(PrismaService);
    hotels = app.get(HotelsService);
    await removeFixtures();
    const alpha = await seedDest("alpha", "active"); // 2 active (one demo-visible)
    await seedHotel(alpha, "a1", { active: true, demoVisible: true });
    await seedHotel(alpha, "a2", { active: true, demoVisible: false });
    const bravo = await seedDest("bravo", "active"); // 1 active (not demo), 1 inactive
    await seedHotel(bravo, "b1", { active: true, demoVisible: false });
    await seedHotel(bravo, "b2", { active: false, demoVisible: false });
    const charlie = await seedDest("charlie", "active"); // only an inactive hotel
    await seedHotel(charlie, "c1", { active: false, demoVisible: false });
    const delta = await seedDest("delta", "draft"); // draft destination with an active hotel
    await seedHotel(delta, "d1", { active: true, demoVisible: true });
    // A SOFT-DELETED (but status-active) destination with an active demo-visible hotel: it must be absent,
    // proving the deletedAt:null scope independently of the draft/status exclusion above.
    const echo = (
      await prisma.destination.create({
        data: {
          name: `${TAG} echo`,
          slug: `${PREFIX}echo`,
          country: "India",
          status: "active",
          deletedAt: new Date(),
        },
        select: { id: true },
      })
    ).id;
    await seedHotel(echo, "e1", { active: true, demoVisible: true });
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  const browse = async (principal: Principal): Promise<{ slug: string; hotelCount: number }[]> => {
    const { items } = await hotels.browseDestinations(principal);
    return items
      .filter((i) => i.slug.startsWith(PREFIX))
      .map((i) => ({ slug: i.slug, hotelCount: i.hotelCount }));
  };

  it("lists active destinations with their in-reach active-hotel counts (AC-04.5)", async () => {
    // A subscriber (all_hotels): Alpha has 2 active hotels, Bravo 1 (its inactive hotel is not counted).
    // Charlie (no active hotels) and Delta (a draft destination) are both absent.
    expect(await browse(fakePrincipal("client", "all_hotels"))).toEqual([
      { slug: `${PREFIX}alpha`, hotelCount: 2 },
      { slug: `${PREFIX}bravo`, hotelCount: 1 },
    ]);
    // A demo prospect (demo_hotels): only demo_visible active hotels count — Alpha drops to 1, Bravo (whose
    // active hotel is not demo-visible) is absent.
    expect(await browse(fakePrincipal("demo", "demo_hotels"))).toEqual([
      { slug: `${PREFIX}alpha`, hotelCount: 1 },
    ]);
  });
});
