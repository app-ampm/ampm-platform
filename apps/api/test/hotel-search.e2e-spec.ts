import { randomUUID } from "node:crypto";

import type { HotelReach, MediaRightsStatus, MediaVisibility } from "@ampm/core";
import type { Entitlements } from "@ampm/policy";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { HotelsService } from "../src/modules/hotels/hotels.service.js";
import type { Principal } from "../src/policy/principal.types.js";
import { startApi } from "./start-api.js";

const TAG = "E2E-HotelSearch";
const PREFIX = "e2e-hotelsearch-";
const ACTOR = "00000000-0000-7000-8000-0000000000aa"; // a plain Uuid for created_by (no FK)

function fakePrincipal(reach: HotelReach, type: "client" | "demo" = "client"): Principal {
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

interface SeedOptions {
  slug: string;
  star: string;
  rooms: number;
  demoVisible?: boolean;
  venue?: { banquet?: number; reception?: number; deleted?: boolean };
  card?: { status: "verified" | "stale" | "draft"; itemClientVisible: boolean };
}

/**
 * Hotel discovery search filters end to end (Module C, feature 9.4; AC-04.6). A subscriber narrows the
 * catalogue by star, accommodation (minRooms), event capacity (minGuestCapacity — a venue's banquet or
 * reception seating) and verified-rates-only; each filter applies within the reach scope. Scoped to one
 * synthetic destination so the assertions are deterministic. The negative fixtures (a stale card, a
 * verified card with no client-visible item, a soft-deleted high-capacity venue) pin the deliberate
 * sub-clauses of the filters, and a zero/blank numeric filter must be a no-op (not an exclude-everything).
 */
describe("Hotel discovery search filters (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let hotels: HotelsService;
  let destinationId: string;
  const id: Record<string, string> = {};

  async function removeFixtures(): Promise<void> {
    const rows = await prisma.hotel.findMany({
      where: { slug: { startsWith: PREFIX } },
      select: { id: true },
    });
    const ids = rows.map((h) => h.id);
    const cards = await prisma.hotelRateCard.findMany({
      where: { hotelId: { in: ids } },
      select: { id: true },
    });
    await prisma.hotelRateItem.deleteMany({
      where: { rateCardId: { in: cards.map((c) => c.id) } },
    });
    await prisma.hotelRateCard.deleteMany({ where: { hotelId: { in: ids } } });
    await prisma.hotelVenue.deleteMany({ where: { hotelId: { in: ids } } });
    await prisma.mediaAsset.deleteMany({ where: { ownerType: "hotel", ownerId: { in: ids } } });
    await prisma.hotel.deleteMany({ where: { id: { in: ids } } });
    await prisma.destination.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  }

  async function seedHotel(opts: SeedOptions): Promise<string> {
    const hotel = await prisma.hotel.create({
      data: {
        destinationId,
        name: `${TAG} ${opts.slug}`,
        slug: `${PREFIX}${opts.slug}`,
        starCategory: opts.star,
        totalRooms: opts.rooms,
        descriptionClient: "A synthetic test hotel.",
        demoVisible: opts.demoVisible ?? false,
        status: "active",
      },
      select: { id: true },
    });
    if (opts.venue) {
      await prisma.hotelVenue.create({
        data: {
          hotelId: hotel.id,
          name: "Venue",
          venueType: "ballroom",
          isIndoor: true,
          capacityBanquet: opts.venue.banquet ?? null,
          capacityReception: opts.venue.reception ?? null,
          deletedAt: opts.venue.deleted ? new Date() : null,
          createdBy: ACTOR,
        },
      });
    }
    if (opts.card) {
      const card = await prisma.hotelRateCard.create({
        data: { hotelId: hotel.id, name: "Card", status: opts.card.status, createdBy: ACTOR },
        select: { id: true },
      });
      await prisma.hotelRateItem.create({
        data: {
          rateCardId: card.id,
          itemType: "wedding_package",
          unit: "per_event",
          amount: "100000.00",
          clientVisible: opts.card.itemClientVisible,
          createdBy: ACTOR,
        },
      });
    }
    return hotel.id;
  }

  /** A clean, client-eligible cover image on a hotel at a visibility, sort order and rights state. */
  async function seedCoverImage(
    hotelId: string,
    visibility: MediaVisibility,
    sortOrder: number,
    rights: MediaRightsStatus = "owned",
  ): Promise<void> {
    const storageKey = `hotel/${hotelId}/${randomUUID()}`;
    await prisma.mediaAsset.create({
      data: {
        ownerType: "hotel",
        ownerId: hotelId,
        kind: "image",
        storageKey,
        thumbnailKey: `${storageKey}.thumb`,
        webKey: `${storageKey}.web`,
        mimeType: "image/jpeg",
        sizeBytes: 100,
        scanStatus: "clean",
        visibility,
        rightsStatus: rights,
        sortOrder,
        createdBy: ACTOR,
        uploadedBy: ACTOR,
      },
    });
  }

  /** The stable `key` of a signed /media/blob link — the handle two signings of one derivative share. */
  function blobKey(url: string): string | null {
    return new URL(url, "http://local").searchParams.get("key");
  }

  beforeAll(async () => {
    ({ app } = await startApi());
    prisma = app.get(PrismaService);
    hotels = app.get(HotelsService);
    await removeFixtures();
    destinationId = (
      await prisma.destination.create({
        data: {
          name: `${TAG} Jaipur`,
          slug: `${PREFIX}jaipur`,
          country: "India",
          status: "active",
        },
        select: { id: true },
      })
    ).id;
    // The match: 5-star, 300 rooms, a 600-seat banquet venue, a verified client-visible card. Also
    // demo-visible, so a demo prospect sees it — the cover test proves its client media is still demo-hidden.
    id.big = await seedHotel({
      slug: "big",
      star: "5",
      rooms: 300,
      demoVisible: true,
      venue: { banquet: 600 },
      card: { status: "verified", itemClientVisible: true },
    });
    // Small on every axis, with only a draft card.
    id.small = await seedHotel({
      slug: "small",
      star: "3",
      rooms: 40,
      venue: { reception: 80 },
      card: { status: "draft", itemClientVisible: true },
    });
    // Verified-rates negatives: a STALE card (not verified) and a verified card with NO client-visible item.
    id.stale = await seedHotel({
      slug: "stale",
      star: "4",
      rooms: 30,
      venue: { reception: 50 },
      card: { status: "stale", itemClientVisible: true },
    });
    id.hidden = await seedHotel({
      slug: "hidden",
      star: "4",
      rooms: 30,
      venue: { reception: 50 },
      card: { status: "verified", itemClientVisible: false },
    });
    // Capacity negative: a 600-seat banquet venue that is SOFT-DELETED, so it must not satisfy the filter.
    id.delven = await seedHotel({
      slug: "delven",
      star: "4",
      rooms: 30,
      venue: { banquet: 600, deleted: true },
    });
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  /** Ids returned for a filter, scoped to the synthetic destination so only the seeded hotels appear. */
  const matched = async (query: Record<string, unknown>): Promise<string[]> => {
    const page = await hotels.list(fakePrincipal("all_hotels"), {
      destinationId,
      limit: 50,
      ...query,
    });
    return page.items.map((h) => h.id).sort();
  };

  it("narrows by each discovery filter, honouring the deliberate exclusions (AC-04.6)", async () => {
    const all = [id.big, id.small, id.stale, id.hidden, id.delven].sort();
    expect(await matched({})).toEqual(all);
    expect(await matched({ star: "5" })).toEqual([id.big]);
    expect(await matched({ minRooms: 100 })).toEqual([id.big]);
    // minGuestCapacity: only big's 600 banquet clears 500; the soft-deleted 600 venue (delven) does NOT.
    expect(await matched({ minGuestCapacity: 500 })).toEqual([id.big]);
    expect(await matched({ minGuestCapacity: 80 })).toEqual([id.big, id.small].sort());
    expect(await matched({ minGuestCapacity: 601 })).toEqual([]);
    // verifiedRatesOnly: excludes draft (small), stale (stale) and a verified card with no visible item (hidden).
    expect(await matched({ verifiedRatesOnly: true })).toEqual([id.big]);
  });

  it("treats a zero (or blank, which coerces to zero) numeric filter as a no-op, not exclude-everything", async () => {
    const all = [id.big, id.small, id.stale, id.hidden, id.delven].sort();
    expect(await matched({ minRooms: 0 })).toEqual(all);
    expect(await matched({ minGuestCapacity: 0 })).toEqual(all);
  });

  it("gives each list card a cover: the lowest-sortOrder client-eligible image, gated by visibility and GP-20 rights (card thumbnails)", async () => {
    // `big` gets, by sort order: an internal image and a consent-required client image (both at 0, both
    // ineligible — visibility and rights), then two owned client images at 1 and 2. The cover is the
    // eligible image with the lowest sort order — the owned client image at 1.
    await seedCoverImage(id.big, "client", 2);
    await seedCoverImage(id.big, "client", 1);
    await seedCoverImage(id.big, "client", 0, "consent_required");
    await seedCoverImage(id.big, "internal", 0);

    const page = await hotels.list(fakePrincipal("all_hotels"), { destinationId, limit: 50 });
    const bigCover = page.items.find((h) => h.id === id.big)?.coverUrl ?? null;
    expect(bigCover).toContain("/media/blob?");

    // It is the SAME photo as the detail hero — the gallery's first client image, re-signed (same key).
    const detail = await hotels.get(fakePrincipal("all_hotels"), id.big);
    const firstImage = detail.gallery.find((g) => g.kind === "image");
    expect(blobKey(bigCover ?? "")).toBe(blobKey(firstImage?.thumbnailUrl ?? ""));

    // A hotel with no eligible image has a null cover, so its card shows the placeholder (`small` has none).
    expect(page.items.find((h) => h.id === id.small)?.coverUrl).toBeNull();

    // A demo prospect SEES `big` (it is demo-visible) but its client-only images are never its cover (GP-20):
    // the demo audience is scoped to public+demo media, so the card falls back to the placeholder.
    const demoPage = await hotels.list(fakePrincipal("demo_hotels", "demo"), {
      destinationId,
      limit: 50,
    });
    const demoBig = demoPage.items.find((h) => h.id === id.big);
    expect(demoBig).toBeDefined();
    expect(demoBig?.coverUrl ?? null).toBeNull();

    await prisma.mediaAsset.deleteMany({ where: { ownerType: "hotel", ownerId: id.big } });
  });
});
