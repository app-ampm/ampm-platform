import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { DEMO_ACCOUNT, DEMO_LEAD, DEMO_USER } from "../src/modules/demo/demo-baseline.js";
import { startApi } from "./start-api.js";

/**
 * The seeded demo prospect's account + originating lead, end to end (Slice 2). Because the seed gave the
 * demo user a `self` contact and an account linked to a Sales lead, a hotel-assistance request RESOLVES
 * the account (no 404) and lands a `demo` lead activity — the P-7 routing that silently no-ops when the
 * demo account is bare. The mechanism itself (with fabricated fixtures) is covered in
 * consultancy-enquiries.e2e-spec.ts; this proves the SEEDED baseline wires up.
 */
describe("Seeded demo account (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app } = await startApi());
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // The routing test appends a `demo` lead activity on DEMO_LEAD whose user_id is DEMO_USER (an
    // ON DELETE RESTRICT FK). Clear it so it can't block demo-restore's rollback user-delete under a
    // different test-file order; the nightly restore resets the demo account's activities in a later slice.
    await prisma.leadActivity.deleteMany({ where: { leadId: DEMO_LEAD.id } });
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it("seeds a demo account linked to its originating lead", async () => {
    const account = await prisma.clientAccount.findUniqueOrThrow({
      where: { id: DEMO_ACCOUNT.id },
    });
    expect(account.isDemo).toBe(true);
    expect(account.leadId).toBe(DEMO_LEAD.id);
    // The self contact's user_id is what resolves the demo user to this account (accountIdForUser).
    const contact = await prisma.accountContact.findFirstOrThrow({
      where: { accountId: DEMO_ACCOUNT.id, relation: "self" },
    });
    expect(contact.userId).toBe(DEMO_USER.id);
  });

  it("routes the seeded demo prospect's hotel-assistance request to Sales as a lead activity", async () => {
    const signIn = await http().post("/auth/dev-login/demo").expect(200);
    const token = signIn.body.data.accessToken as string;
    const auth = `Bearer ${token}`;

    const hotels = await http().get("/hotels").set("authorization", auth).expect(200);
    const hotelId = (hotels.body.data.items as { id: string }[])[0]!.id;

    const result = await http()
      .post("/consultancy/enquiries")
      .set("authorization", auth)
      .send({
        hotelId,
        dateFrom: "2027-02-14",
        dateTo: "2027-02-16",
        datesFlexible: false,
        guestEstimate: 120,
      })
      .expect(201);
    // Resolves the seeded account (no 404) and routes to Sales — never an enquiry (P-7).
    expect(result.body.data).toEqual({ kind: "routed_to_sales" });

    // The inline job appended a `demo` activity to the seeded lead (idempotent on account+hotel).
    const activities = await prisma.leadActivity.count({
      where: { leadId: DEMO_LEAD.id, activityType: "demo" },
    });
    expect(activities).toBeGreaterThanOrEqual(1);
  });
});
