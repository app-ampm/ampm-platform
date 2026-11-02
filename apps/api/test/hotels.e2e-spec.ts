import { randomUUID } from "node:crypto";

import type { HotelReach, MediaVisibility } from "@ampm/core";
import type { Entitlements } from "@ampm/policy";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { HotelsService } from "../src/modules/hotels/hotels.service.js";
import type { Principal } from "../src/policy/principal.types.js";
import { startApi } from "./start-api.js";

const TAG = "E2E-Hotels";
const PREFIX = "e2e-hotels";
const GALLERY_ACTOR = "00000000-0000-7000-8000-0000000000aa"; // a plain Uuid; uploaded_by has no FK

/** A fabricated client/demo principal for service-level reach tests (no HTTP round-trip needed). */
function fakeEntitlements(reach: HotelReach, readOnly: boolean): Entitlements {
  return {
    modules: ["hotel_discovery", "saved_hotels"],
    readOnlyModules: readOnly ? ["saved_hotels"] : [],
    hotelReach: [reach],
    financeReach: [],
    requestTypes: { wedding: [], account: [] },
    signInRefused: false,
  };
}

function fakePrincipal(
  type: "client" | "demo",
  ent: Entitlements,
  userId = "00000000-0000-7000-8000-000000000000",
): Principal {
  return {
    type,
    userId,
    name: "T",
    email: null,
    phone: null,
    status: "active",
    lastLoginAt: null,
    memberships: [],
    entitlements: ent,
  };
}

/**
 * Hotel discovery end to end (Module C, CP-11). A client with no subscription is locked out (404 —
 * denial equals absence); a staff principal is refused the same way; an active subscriber browses the
 * catalogue, opens a hotel (no internal fields on the wire), saves/removes it on their own shortlist, and
 * never sees another account's shortlist. Demo isolation (demo_visible) is proven at the service level,
 * since the dev-login does not mint a demo token.
 */
describe("Hotel discovery (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let hotels: HotelsService;
  let mint: (subject: string) => Promise<string>;
  let planId: string;
  let destinationId: string;
  let hotelA: string; // active, demo-visible
  let hotelB: string; // active, demo-visible
  let hotelC: string; // active, NOT demo-visible
  let hotelD: string; // inactive (never browsable)

  async function removeFixtures(): Promise<void> {
    const accounts = await prisma.clientAccount.findMany({
      where: { name: { startsWith: TAG } },
      select: { id: true },
    });
    const accountIds = accounts.map((a) => a.id);
    const users = await prisma.user.findMany({
      where: { email: { startsWith: PREFIX } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    await prisma.savedHotel.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.payment.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.subscription.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.accountContact.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.clientAccount.deleteMany({ where: { id: { in: accountIds } } });
    await prisma.notification.deleteMany({ where: { recipientId: { in: userIds } } });
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    const hotelRows = await prisma.hotel.findMany({
      where: { slug: { startsWith: PREFIX } },
      select: { id: true },
    });
    await prisma.mediaAsset.deleteMany({
      where: { ownerType: "hotel", ownerId: { in: hotelRows.map((h) => h.id) } },
    });
    await prisma.hotel.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.destination.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  }

  /** A client with a prospect account; `subject` mints their token, `userId`/`accountId` for assertions. */
  async function provisionClient(
    suffix: string,
    userType: "client" | "staff" = "client",
  ): Promise<{ subject: string; userId: string; accountId: string }> {
    const account = await prisma.clientAccount.create({
      data: { name: `${TAG} ${suffix}`, status: "prospect" },
      select: { id: true },
    });
    const subject = `local:${PREFIX}-${suffix}`;
    const user = await prisma.user.create({
      data: {
        userType,
        name: `${TAG} ${suffix}`,
        email: `${PREFIX}-${suffix}@example.com`,
        status: "active",
        identitySubject: subject,
      },
      select: { id: true },
    });
    await prisma.accountContact.create({
      data: {
        accountId: account.id,
        name: `${TAG} ${suffix}`,
        relation: "primary",
        userId: user.id,
      },
    });
    return { subject, userId: user.id, accountId: account.id };
  }

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => `Bearer ${token}`;

  /** A clean, rights-cleared gallery image on an owner at one visibility, with both derivatives present. */
  async function seedGalleryImage(ownerId: string, visibility: MediaVisibility): Promise<void> {
    const storageKey = `hotel/${ownerId}/${randomUUID()}`;
    await prisma.mediaAsset.create({
      data: {
        ownerType: "hotel",
        ownerId,
        kind: "image",
        storageKey,
        thumbnailKey: `${storageKey}.thumb`,
        webKey: `${storageKey}.web`,
        mimeType: "image/jpeg",
        sizeBytes: 100,
        scanStatus: "clean",
        visibility,
        rightsStatus: "owned",
        caption: visibility, // the caption doubles as the visibility label the assertions read
        uploadedBy: GALLERY_ACTOR,
        createdBy: GALLERY_ACTOR,
      },
    });
  }

  /** A clean, client-visible row with NO derivatives (a video): listGallery returns it, isGalleryReady drops it. */
  async function seedNoDerivative(ownerId: string): Promise<void> {
    const storageKey = `hotel/${ownerId}/${randomUUID()}`;
    await prisma.mediaAsset.create({
      data: {
        ownerType: "hotel",
        ownerId,
        kind: "video",
        storageKey,
        thumbnailKey: null,
        webKey: null,
        mimeType: "video/mp4",
        sizeBytes: 100,
        scanStatus: "clean",
        visibility: "client",
        rightsStatus: "owned",
        caption: "novid",
        uploadedBy: GALLERY_ACTOR,
        createdBy: GALLERY_ACTOR,
      },
    });
  }

  /** Buy the Discovery plan for the token's own account and complete the stub payment → all_hotels. */
  async function activate(token: string): Promise<void> {
    const purchase = await http()
      .post("/crm/portal/subscriptions")
      .set("authorization", auth(token))
      .send({ planId })
      .expect(201);
    await http()
      .post("/crm/portal/complete-payment")
      .set("authorization", auth(token))
      .send({ subscriptionId: purchase.body.data.subscriptionId })
      .expect(200);
  }

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    hotels = app.get(HotelsService);
    await removeFixtures();
    planId = (await prisma.plan.findUniqueOrThrow({ where: { planKey: "discovery" } })).id;

    const destination = await prisma.destination.create({
      data: { name: `${TAG} Jaipur`, slug: `${PREFIX}-jaipur`, country: "India", status: "active" },
      select: { id: true },
    });
    destinationId = destination.id;
    const make = async (slug: string, demoVisible: boolean, active: boolean): Promise<string> =>
      (
        await prisma.hotel.create({
          data: {
            destinationId,
            name: `${TAG} ${slug}`,
            slug: `${PREFIX}-${slug}`,
            descriptionClient: "A synthetic test hotel.",
            internalRating: 5, // RESTRICTED — must never reach the client
            internalNotes: "internal only",
            demoVisible,
            status: active ? "active" : "inactive",
          },
          select: { id: true },
        })
      ).id;
    hotelA = await make("a", true, true);
    hotelB = await make("b", true, true);
    hotelC = await make("c", false, true);
    hotelD = await make("d", true, false);
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  it("locks a client with no subscription out of discovery (denial equals absence)", async () => {
    const { subject } = await provisionClient("locked");
    await http()
      .get(`/hotels?destinationId=${destinationId}`)
      .set("authorization", auth(await mint(subject)))
      .expect(404);
  });

  it("refuses discovery for a staff principal (no client entitlements)", async () => {
    const { subject } = await provisionClient("staff", "staff");
    await http()
      .get(`/hotels?destinationId=${destinationId}`)
      .set("authorization", auth(await mint(subject)))
      .expect(404);
  });

  it("lets an active subscriber browse, open, save, list and remove a hotel", async () => {
    const token = await mint((await provisionClient("buyer")).subject);
    await activate(token);

    const list = await http()
      .get(`/hotels?destinationId=${destinationId}`)
      .set("authorization", auth(token))
      .expect(200);
    const ids = (list.body.data.items as { id: string }[]).map((h) => h.id);
    expect(ids.sort()).toEqual([hotelA, hotelB, hotelC].sort()); // active only — the inactive hotel is absent
    expect(ids).not.toContain(hotelD);

    const detail = await http()
      .get(`/hotels/${hotelA}`)
      .set("authorization", auth(token))
      .expect(200);
    expect(detail.body.data.name).toBe(`${TAG} a`);
    expect(detail.body.data).not.toHaveProperty("internalRating"); // RESTRICTED-NOTES never serialised
    expect(detail.body.data).not.toHaveProperty("internalNotes");

    await http().post(`/hotels/${hotelA}/save`).set("authorization", auth(token)).expect(201);
    // A second save is idempotent — one row per (account, hotel), not a duplicate.
    await http().post(`/hotels/${hotelA}/save`).set("authorization", auth(token)).expect(201);
    const saved = await http().get("/hotels/saved").set("authorization", auth(token)).expect(200);
    expect(saved.body.data.items).toHaveLength(1);
    expect(saved.body.data.items[0].hotel.id).toBe(hotelA);

    await http().delete(`/hotels/${hotelA}/save`).set("authorization", auth(token)).expect(200);
    const empty = await http().get("/hotels/saved").set("authorization", auth(token)).expect(200);
    expect(empty.body.data.items).toHaveLength(0);
  });

  it("never shows one account's shortlist to another", async () => {
    const owner = await mint((await provisionClient("owner")).subject);
    const intruder = await mint((await provisionClient("intruder")).subject);
    await activate(owner);
    await activate(intruder);
    await http().post(`/hotels/${hotelB}/save`).set("authorization", auth(owner)).expect(201);

    const intruderSaved = await http()
      .get("/hotels/saved")
      .set("authorization", auth(intruder))
      .expect(200);
    expect(intruderSaved.body.data.items).toHaveLength(0);
  });

  it("scopes the catalogue by reach: a demo principal sees only demo_visible hotels", async () => {
    const all = await hotels.list(fakePrincipal("client", fakeEntitlements("all_hotels", false)), {
      destinationId,
      limit: 50,
    });
    const demo = await hotels.list(fakePrincipal("demo", fakeEntitlements("demo_hotels", true)), {
      destinationId,
      limit: 50,
    });
    expect(all.items.map((h) => h.id).sort()).toEqual([hotelA, hotelB, hotelC].sort());
    expect(demo.items.map((h) => h.id).sort()).toEqual([hotelA, hotelB].sort());
  });

  it("denies an out-of-reach (project_hotels) principal — empty list, 404 on detail and save", async () => {
    // ACTIVE_PROJECT grants hotel_discovery (read) + saved_hotels (write) but hotelReach
    // ['project_hotels'], whose catalogue joins are deferred — the empty-reach branch. No active
    // catalogue hotel may leak through list, detail or save. Regression guard for the findInReach
    // id-clobber bug: the client HAS an account, so a 404 on save proves the reach guard, not a
    // missing account.
    const { userId } = await provisionClient("project-only");
    const principal = fakePrincipal("client", fakeEntitlements("project_hotels", false), userId);
    const list = await hotels.list(principal, { destinationId, limit: 50 });
    expect(list.items).toEqual([]);
    await expect(hotels.get(principal, hotelA)).rejects.toMatchObject({ code: "not_found" });
    await expect(hotels.save(principal, hotelA)).rejects.toMatchObject({ code: "not_found" });
  });

  it("shows a hotel gallery of exactly the media at or below the principal's level (AC-24.4)", async () => {
    await prisma.mediaAsset.deleteMany({ where: { ownerType: "hotel", ownerId: hotelA } });
    for (const v of ["internal", "demo", "client", "public"] as const) {
      await seedGalleryImage(hotelA, v);
    }
    // A clean, client-visible row with no derivatives: in listGallery's scope but excluded by isGalleryReady,
    // so it must NOT appear below (otherwise the gallery would sign null keys into broken links).
    await seedNoDerivative(hotelA);

    const asClient = await hotels.get(
      fakePrincipal("client", fakeEntitlements("all_hotels", false)),
      hotelA,
    );
    const asDemo = await hotels.get(
      fakePrincipal("demo", fakeEntitlements("demo_hotels", true)),
      hotelA,
    );

    // "At or below": a client sees public+demo+client; a demo prospect sees public+demo; internal reaches
    // neither (the staff-only level). The public website visitor path (public only) is a separate surface.
    expect(asClient.gallery.map((m) => m.caption).sort()).toEqual(["client", "demo", "public"]);
    expect(asDemo.gallery.map((m) => m.caption).sort()).toEqual(["demo", "public"]);

    // Each item is a pair of signed blob links and nothing else — no object-key field crosses the boundary.
    for (const item of asClient.gallery) {
      expect(Object.keys(item).sort()).toEqual(["caption", "id", "kind", "thumbnailUrl", "webUrl"]);
      expect(item.thumbnailUrl).toContain("/media/blob?");
      expect(item.webUrl).toContain("/media/blob?");
    }
  });
});
