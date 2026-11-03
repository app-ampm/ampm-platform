import type { HotelReach } from "@ampm/core";
import type { Entitlements } from "@ampm/policy";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { HotelsService } from "../src/modules/hotels/hotels.service.js";
import type { Principal } from "../src/policy/principal.types.js";
import { startApi } from "./start-api.js";

const TAG = "E2E-RefRender";
const PREFIX = "e2e-ref-render-";
const CONSENT_DOC = "0192f1a0-0000-7000-8000-00000000d0c1"; // a plain Uuid; consent_document_id has no FK

function fakeEntitlements(reach: HotelReach): Entitlements {
  return {
    modules: ["hotel_discovery"],
    readOnlyModules: [],
    hotelReach: [reach],
    financeReach: [],
    requestTypes: { wedding: [], account: [] },
    signInRefused: false,
  };
}

function fakePrincipal(type: "client" | "demo", reach: HotelReach): Principal {
  return {
    type,
    userId: "00000000-0000-7000-8000-000000000000",
    name: "T",
    email: null,
    phone: null,
    status: "active",
    lastLoginAt: null,
    memberships: [],
    entitlements: fakeEntitlements(reach),
  };
}

/**
 * Client rendering of previous-wedding references end to end (Module C, feature 9.3; GP-20, AC-24.4). A
 * hotel detail shows only the consented, client-visible references, each the social-proof content alone —
 * never the internal project/consent key. References carry a single `client_visible` flag (no
 * public<demo<client level chain like the gallery), so a real client and a demo prospect see the same
 * consented set once the hotel is in their reach. The staff CRUD and the GP-20 gate are a sibling suite.
 */
describe("Client reference rendering (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let hotels: HotelsService;
  let hotelId: string;

  async function removeFixtures(): Promise<void> {
    const rows = await prisma.hotel.findMany({
      where: { slug: { startsWith: PREFIX } },
      select: { id: true },
    });
    const ids = rows.map((h) => h.id);
    await prisma.hotelWeddingReference.deleteMany({ where: { hotelId: { in: ids } } });
    await prisma.hotel.deleteMany({ where: { id: { in: ids } } });
    await prisma.destination.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  }

  async function seedReference(clientVisible: boolean, eventYear: number): Promise<void> {
    await prisma.hotelWeddingReference.create({
      data: {
        hotelId,
        eventYear,
        guestCount: 200,
        descriptionClient: clientVisible ? "visible" : "hidden",
        clientVisible,
        consentDocumentId: clientVisible ? CONSENT_DOC : null,
      },
    });
  }

  beforeAll(async () => {
    ({ app } = await startApi());
    prisma = app.get(PrismaService);
    hotels = app.get(HotelsService);
    await removeFixtures();
    const destination = await prisma.destination.create({
      data: {
        name: `${TAG} Udaipur`,
        slug: `${PREFIX}udaipur`,
        country: "India",
        status: "active",
      },
      select: { id: true },
    });
    const hotel = await prisma.hotel.create({
      data: {
        destinationId: destination.id,
        name: `${TAG} Palace`,
        slug: `${PREFIX}palace`,
        descriptionClient: "A synthetic test hotel.",
        demoVisible: true,
        status: "active",
      },
      select: { id: true },
    });
    hotelId = hotel.id;
    await seedReference(true, 2024); // consented + client-visible → shown
    await seedReference(false, 2023); // internal (no consent) → never shown
    // A consented, client-visible reference that was later soft-deleted (consent withdrawn) must NOT
    // resurface on the detail — this proves the deletedAt:null scope, not just the clientVisible filter.
    await prisma.hotelWeddingReference.create({
      data: {
        hotelId,
        eventYear: 2025,
        clientVisible: true,
        consentDocumentId: CONSENT_DOC,
        deletedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  it("shows only consented, client-visible references, as content with no governance key (GP-20)", async () => {
    const asClient = await hotels.get(fakePrincipal("client", "all_hotels"), hotelId);
    const asDemo = await hotels.get(fakePrincipal("demo", "demo_hotels"), hotelId);

    expect(asClient.references.map((r) => r.eventYear)).toEqual([2024]);
    expect(asDemo.references.map((r) => r.eventYear)).toEqual([2024]);

    // Content only — no projectId / consentDocumentId / clientVisible / hotelId crosses the boundary.
    for (const item of asClient.references) {
      expect(Object.keys(item).sort()).toEqual([
        "descriptionClient",
        "eventYear",
        "guestCount",
        "id",
      ]);
    }
  });
});
