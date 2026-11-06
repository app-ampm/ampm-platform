import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

const TAG = "E2E-HotelCompare";
const PREFIX = "e2e-hotelcompare-";
// Well-formed uuids that are never created, for the "none of these are on the shortlist" path.
const GHOST1 = "018f0000-0000-7000-8000-0000000000f1";
const GHOST2 = "018f0000-0000-7000-8000-0000000000f2";

/**
 * Hotel compare end to end (Module C, feature 9.4c; CP-06). A subscriber compares a handful of hotels on
 * their OWN shortlist: the result holds only the ids they have saved AND can still see in reach, in the
 * order asked, each a compare item (the client card plus its freshness-labelled rates — no gallery or
 * references). An unsaved id, and a saved id that later falls out of reach, are both silently absent
 * (denial equals absence). The GET /hotels/compare calls also prove the literal route resolves ahead of
 * :hotelId. Filtered to the synthetic PREFIX so the assertions ignore the baseline seed.
 */
describe("Hotel compare (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;
  let prisma: PrismaService;
  let adminAuth: string;
  let destinationId: string;
  let clientToken: string;
  let intruderToken: string;
  let alpha: string;
  let bravo: string;
  let charlie: string;
  let delta: string;

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => `Bearer ${token}`;

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
    const hotels = await prisma.hotel.findMany({
      where: { slug: { startsWith: PREFIX } },
      select: { id: true },
    });
    await prisma.savedHotel.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.payment.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.subscription.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.accountContact.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.clientAccount.deleteMany({ where: { id: { in: accountIds } } });
    await prisma.session.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
    await prisma.hotel.deleteMany({ where: { id: { in: hotels.map((h) => h.id) } } });
    await prisma.destination.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  }

  /** An active hotel the all_hotels subscriber can open (admin create defaults to draft, hidden). */
  async function makeHotel(slug: string): Promise<string> {
    const hotel = await http()
      .post("/hotels-admin/hotels")
      .set("Authorization", adminAuth)
      .send({ destinationId, name: `${TAG} ${slug}`, slug: `${PREFIX}${slug}`, status: "active" })
      .expect(201);
    return hotel.body.data.id;
  }

  async function saveHotel(hotelId: string): Promise<void> {
    await http()
      .post(`/hotels/${hotelId}/save`)
      .set("authorization", auth(clientToken))
      .expect(201);
  }

  /** A client with a prospect account and an active Discovery subscription (all_hotels reach). */
  async function provisionSubscriber(suffix: string): Promise<string> {
    const account = await prisma.clientAccount.create({
      data: { name: `${TAG} ${suffix}`, status: "prospect" },
      select: { id: true },
    });
    const subject = `local:${PREFIX}${suffix}`;
    const user = await prisma.user.create({
      data: {
        userType: "client",
        name: `${TAG} ${suffix}`,
        email: `${PREFIX}${suffix}@example.com`,
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
    const token = await mint(subject);
    const planId = (await prisma.plan.findUniqueOrThrow({ where: { planKey: "discovery" } })).id;
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
    return token;
  }

  const compare = (token: string, ids: string[]): request.Test =>
    http()
      .get("/hotels/compare")
      .query({ ids: ids.join(",") })
      .set("authorization", auth(token));

  const idsOf = (res: request.Response): string[] =>
    res.body.data.items.map((item: { id: string }) => item.id);

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
    adminAuth = `Bearer ${await mint("local:admin")}`;
    const dest = await http()
      .post("/hotels-admin/destinations")
      .set("Authorization", adminAuth)
      .send({ name: "E2E Compare Destination", slug: `${PREFIX}dest`, status: "active" })
      .expect(201);
    destinationId = dest.body.data.id;
    clientToken = await provisionSubscriber("buyer");
    intruderToken = await provisionSubscriber("intruder"); // a second account, own reach, saves nothing
    alpha = await makeHotel("alpha");
    bravo = await makeHotel("bravo");
    charlie = await makeHotel("charlie"); // active but never saved
    delta = await makeHotel("delta");
    await saveHotel(alpha);
    await saveHotel(bravo);
    await saveHotel(delta);
    // delta is on the shortlist, then taken out of reach — a saved hotel the subscriber can no longer open.
    await prisma.hotel.update({ where: { id: delta }, data: { status: "inactive" } });
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  it("compares the caller's saved hotels in the order asked, each a card-plus-rates item", async () => {
    const res = await compare(clientToken, [bravo, alpha]).expect(200);
    expect(idsOf(res)).toEqual([bravo, alpha]); // the requested order, not a DB order
    for (const item of res.body.data.items) {
      expect(item.rates.status).toBe("on_request"); // the compare item carries rates (none seeded here)...
      expect(item).not.toHaveProperty("gallery"); // ...but not the detail's gallery...
      expect(item).not.toHaveProperty("references"); // ...or references (compare is the lighter read)
      expect(item).not.toHaveProperty("internalNotes"); // and no RESTRICTED field (security.md)
    }
  });

  it("omits an id the caller has not saved — compare is a view over the shortlist", async () => {
    const res = await compare(clientToken, [alpha, charlie]).expect(200);
    expect(idsOf(res)).toEqual([alpha]); // charlie is in reach but not saved
  });

  it("omits a saved hotel that has fallen out of reach (saved never bypasses reach)", async () => {
    const res = await compare(clientToken, [alpha, delta]).expect(200);
    expect(idsOf(res)).toEqual([alpha]); // delta is saved but no longer active
  });

  it("never returns another account's saved hotels (the shortlist is account-scoped)", async () => {
    // The intruder is a separate subscriber with its own account and all_hotels reach, but has saved nothing.
    // alpha and bravo are active and in the intruder's reach, yet belong to the buyer's shortlist alone, so
    // the intruder's compare must be empty — this pins the accountId scope in savedHotelIds (tenant isolation).
    const res = await compare(intruderToken, [alpha, bravo]).expect(200);
    expect(idsOf(res)).toEqual([]); // denial equals absence — not the buyer's hotels
  });

  it("returns an empty comparison (200, not an error) when no requested id is on the shortlist", async () => {
    const res = await compare(clientToken, [GHOST1, GHOST2]).expect(200);
    expect(res.body.data.items).toEqual([]); // the denial-equals-absence empty path, never a 404/throw
  });

  it("rejects a malformed id set at the edge (fewer than two, more than four, duplicate, or not a uuid)", async () => {
    await compare(clientToken, [alpha]).expect(400); // one id is not a comparison
    await compare(clientToken, [alpha, bravo, charlie, delta, GHOST1]).expect(400); // more than four
    await compare(clientToken, [alpha, alpha]).expect(400); // duplicate ids are not a comparison
    await http()
      .get("/hotels/compare")
      .query({ ids: "not-a-uuid,also-bad" })
      .set("authorization", auth(clientToken))
      .expect(400);
  });
});
