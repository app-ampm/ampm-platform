import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { SavedHotelsStaffService } from "../src/modules/hotels/saved-hotels-staff.service.js";
import type { StaffPrincipal } from "../src/policy/principal.types.js";
import { startApi } from "./start-api.js";

const TAG = "E2E-SavedStaff";
const PREFIX = "e2e-savedstaff";
const DAY_MS = 86_400_000;
// The seeded wedding the seeded Project Manager is assigned to (prisma/seed.ts SEED.projectId).
const SEED_PROJECT_ID = "0192f3a0-7d3e-7b1a-9c2f-0000000000a1";
// saved_by_user_id is a plain Uuid with no foreign key; the rows here never need a real client user.
const SAVED_BY = "00000000-0000-7000-8000-0000000000ab";

/** A Project Manager on the seeded wedding, for the service-level scope check. */
const ASSIGNED_PM: StaffPrincipal = {
  type: "staff",
  userId: "00000000-0000-7000-8000-0000000000ac",
  name: "T",
  email: null,
  phone: null,
  status: "active",
  lastLoginAt: null,
  roles: ["PM"],
  memberships: [
    {
      projectId: SEED_PROJECT_ID,
      projectRole: "project_lead",
      clientSide: null,
      canViewFinance: false,
      canApprove: false,
    },
  ],
};

type AccountKey = "a" | "b" | "demo";
type HotelKey = "lake" | "fort" | "dunes";
type SaveKey = "aLake" | "aFort" | "aDunesRemoved" | "bLake" | "demoLake";

interface SavedItem {
  readonly id: string;
  readonly hotel: { id: string; name: string; status: string; destinationName: string };
  readonly account: { id: string; name: string };
  readonly note: string | null;
  readonly savedAt: string;
}

/**
 * Clients' saved hotels for staff (permission-matrix §5.3, `hotels.saved_hotels.read`): SA, SM and HT
 * read every client's list, one client's whole list or one hotel's savers; Finance, Creative and clients
 * are refused with the 404 of an absent record. A Project Manager's assigned-wedding grant is not
 * route-reachable yet (no wedding on the route; the service-agreements precedent), so the route refuses
 * it, while the service already scopes it to saves on their weddings. Demo accounts and removed saves never appear. Rows are
 * written straight to the database; the reads go through the API.
 */
describe("Clients' saved hotels for staff (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let mint: (subject: string) => Promise<string>;
  const accounts = {} as Record<AccountKey, string>;
  const hotels = {} as Record<HotelKey, string>;
  const saves = {} as Record<SaveKey, string>;

  const http = () => request(app.getHttpServer());
  const as = async (subject: string) => `Bearer ${await mint(subject)}`;
  /** The staff list as `subject` reads it, asserting the status. */
  const list = async (subject: string, query: string, status = 200) =>
    http()
      .get(`/hotels-admin/saved-hotels${query}`)
      .set("authorization", await as(subject))
      .expect(status);
  const ours = (items: readonly SavedItem[]) =>
    items.map((item) => item.id).filter((id) => Object.values(saves).includes(id));

  async function removeFixtures(): Promise<void> {
    const rows = await prisma.clientAccount.findMany({
      where: { name: { startsWith: TAG } },
      select: { id: true },
    });
    const accountIds = rows.map((row) => row.id);
    await prisma.savedHotel.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.clientAccount.deleteMany({ where: { id: { in: accountIds } } });
    await prisma.hotel.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.destination.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  }

  async function seedHotel(key: HotelKey, destinationId: string, status: "active" | "inactive") {
    hotels[key] = (
      await prisma.hotel.create({
        data: { destinationId, name: `${TAG} ${key}`, slug: `${PREFIX}-${key}`, status },
        select: { id: true },
      })
    ).id;
  }

  async function seedSave(
    key: SaveKey,
    account: AccountKey,
    hotel: HotelKey,
    daysAgo: number,
    extra: { note?: string; projectId?: string; deletedAt?: Date } = {},
  ) {
    saves[key] = (
      await prisma.savedHotel.create({
        data: {
          accountId: accounts[account],
          hotelId: hotels[hotel],
          savedByUserId: SAVED_BY,
          createdAt: new Date(Date.now() - daysAgo * DAY_MS),
          ...extra,
        },
        select: { id: true },
      })
    ).id;
  }

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
    const destination = await prisma.destination.create({
      data: {
        name: `${TAG} Udaipur`,
        slug: `${PREFIX}-udaipur`,
        country: "India",
        status: "active",
      },
      select: { id: true },
    });
    await seedHotel("lake", destination.id, "active");
    await seedHotel("fort", destination.id, "inactive");
    await seedHotel("dunes", destination.id, "active");
    for (const key of ["a", "b", "demo"] as const) {
      accounts[key] = (
        await prisma.clientAccount.create({
          data: { name: `${TAG} ${key}`, status: "active", isDemo: key === "demo" },
          select: { id: true },
        })
      ).id;
    }
    await seedSave("aLake", "a", "lake", 5, { note: "Loved the lake-facing lawn" });
    await seedSave("aFort", "a", "fort", 4);
    await seedSave("aDunesRemoved", "a", "dunes", 3, { deletedAt: new Date() });
    await seedSave("bLake", "b", "lake", 2, { projectId: SEED_PROJECT_ID });
    await seedSave("demoLake", "demo", "lake", 1);
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  it("reads one client's complete list, newest first, with the hotel, the account and the note", async () => {
    const res = await list("local:admin", `?accountId=${accounts.a}`);
    const items: SavedItem[] = res.body.data.items;
    expect(items.map((item) => item.id)).toEqual([saves.aFort, saves.aLake]);
    expect(items[1]).toEqual({
      id: saves.aLake,
      hotel: {
        id: hotels.lake,
        name: `${TAG} lake`,
        starCategory: null,
        status: "active",
        destinationName: `${TAG} Udaipur`,
      },
      account: { id: accounts.a, name: `${TAG} a` },
      note: "Loved the lake-facing lawn",
      savedAt: expect.any(String),
    });
    expect(items[0]?.hotel.status).toBe("inactive");
    expect(res.body.data.nextCursor).toBeNull();
  });

  it("lists every client's saves newest first, leaving out demo accounts and removed saves", async () => {
    const res = await list("local:admin", "?limit=100");
    expect(ours(res.body.data.items)).toEqual([saves.bLake, saves.aFort, saves.aLake]);
  });

  it("is read by Sales and the Hotel team", async () => {
    for (const subject of ["local:sm", "local:ht"]) {
      const res = await list(subject, `?accountId=${accounts.b}`);
      expect(ours(res.body.data.items)).toEqual([saves.bLake]);
    }
  });

  it("refuses a Project Manager on the route: an assigned grant names no wedding here yet", async () => {
    await list("local:pm", "?limit=100", 404);
  });

  it("scopes an assigned grant to the saves on the Project Manager's weddings", async () => {
    const page = await app
      .get(SavedHotelsStaffService)
      .list(ASSIGNED_PM, { key: "hotels.saved_hotels.read", scope: "assigned" }, { limit: 100 });
    expect(ours(page.items)).toEqual([saves.bLake]);
  });

  it("refuses Finance, Creative and a client with the 404 of an absent record", async () => {
    for (const subject of ["local:fa", "local:cd", "local:client"]) {
      await list(subject, `?accountId=${accounts.a}`, 404);
    }
  });

  it("pages one client's list with a cursor", async () => {
    const first = await list("local:sm", `?accountId=${accounts.a}&limit=1`);
    expect(ours(first.body.data.items)).toEqual([saves.aFort]);
    const cursor: string = first.body.data.nextCursor;
    const second = await list("local:sm", `?accountId=${accounts.a}&limit=1&cursor=${cursor}`);
    expect(ours(second.body.data.items)).toEqual([saves.aLake]);
    expect(second.body.data.nextCursor).toBeNull();
  });

  it("rejects a malformed account id at the edge (400)", async () => {
    await list("local:admin", "?accountId=not-a-uuid", 400);
  });

  describe("one hotel's savers (`hotelId`, the hotel's staff page)", () => {
    it("lists every client who saved the hotel, newest first, leaving out the demo account", async () => {
      const res = await list("local:ht", `?hotelId=${hotels.lake}`);
      const items: SavedItem[] = res.body.data.items;
      expect(items.map((item) => item.id)).toEqual([saves.bLake, saves.aLake]);
      expect(items.map((item) => item.account)).toEqual([
        { id: accounts.b, name: `${TAG} b` },
        { id: accounts.a, name: `${TAG} a` },
      ]);
      expect(items.every((item) => item.hotel.id === hotels.lake)).toBe(true);
      expect(res.body.data.nextCursor).toBeNull();
    });

    it("leaves a removed save out, so a hotel no client keeps has no savers", async () => {
      const res = await list("local:sm", `?hotelId=${hotels.dunes}`);
      expect(res.body.data).toEqual({ items: [], nextCursor: null });
    });

    it("narrows to one client's save of the hotel when both filters are given", async () => {
      const res = await list("local:admin", `?hotelId=${hotels.lake}&accountId=${accounts.a}`);
      expect(ours(res.body.data.items)).toEqual([saves.aLake]);
    });

    it("pages a hotel's savers with a cursor", async () => {
      const first = await list("local:ht", `?hotelId=${hotels.lake}&limit=1`);
      expect(ours(first.body.data.items)).toEqual([saves.bLake]);
      const cursor: string = first.body.data.nextCursor;
      const second = await list("local:ht", `?hotelId=${hotels.lake}&limit=1&cursor=${cursor}`);
      expect(ours(second.body.data.items)).toEqual([saves.aLake]);
      expect(second.body.data.nextCursor).toBeNull();
    });

    it("refuses Finance and a client a hotel's savers with the 404 of an absent record", async () => {
      for (const subject of ["local:fa", "local:client"]) {
        await list(subject, `?hotelId=${hotels.lake}`, 404);
      }
    });

    it("rejects a malformed hotel id at the edge (400)", async () => {
      await list("local:admin", "?hotelId=not-a-uuid", 400);
    });
  });
});
