import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

/** This suite's accounts share this name prefix, so its cleanup touches nothing else. */
const TAG = "E2E-SubReport";

/** Every field the strict report row carries, and nothing else (D-127). */
const ROW_FIELDS = [
  "accountId",
  "accountName",
  "amount",
  "createdAt",
  "endsAt",
  "lastPayment",
  "planId",
  "planName",
  "startsAt",
  "status",
  "subscriptionId",
];

interface ReportRow {
  readonly subscriptionId: string;
  readonly accountName: string;
  readonly planName: string;
  readonly amount: { readonly minor: number; readonly currency: string };
  readonly status: string;
  readonly createdAt: string;
  readonly lastPayment: { method: string; status: string; paidAt: string | null } | null;
}

/**
 * The "Subscription status and payment history" report end to end (`GET /crm/reports/subscriptions`,
 * permission-matrix §5.16). Finance, whose CRM grants are field-conditioned, lists the subscriptions it
 * records payments against through it (D-127); Super Admin and Sales may run it too. Each row is the
 * strict CLIENT-class report row; demo accounts are left out; any other role is refused as absence.
 */
describe("Subscription status report (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;
  let prisma: PrismaService;
  let plan: { id: string; name: string; priceMinor: number };
  const ids = { awaiting: "", paid: "", demo: "" };

  async function removeFixtures(): Promise<void> {
    const accounts = await prisma.clientAccount.findMany({
      where: { name: { startsWith: TAG } },
      select: { id: true },
    });
    const accountIds = accounts.map((account) => account.id);
    await prisma.payment.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.subscription.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.clientAccount.deleteMany({ where: { id: { in: accountIds } } });
  }

  const http = () => request(app.getHttpServer());
  const bearer = async (subject: string) => `Bearer ${await mint(subject)}`;

  async function account(suffix: string, isDemo = false): Promise<string> {
    const created = await prisma.clientAccount.create({
      data: { name: `${TAG} ${suffix}`, status: "prospect", isDemo },
      select: { id: true },
    });
    return created.id;
  }

  /** Sales buys the plan for the account: a subscription awaiting payment and its gateway attempt. */
  async function purchase(accountId: string): Promise<string> {
    const res = await http()
      .post("/crm/subscriptions")
      .set("authorization", await bearer("local:sm"))
      .send({ accountId, planId: plan.id })
      .expect(201);
    return res.body.data.subscriptionId as string;
  }

  /** Every page of the report for one status, as one role sees it. */
  async function allRows(subject: string, status?: string): Promise<ReportRow[]> {
    const rows: ReportRow[] = [];
    let cursor: string | null = null;
    do {
      const query = new URLSearchParams({ limit: "100" });
      if (status) query.set("status", status);
      if (cursor) query.set("cursor", cursor);
      const res = await http()
        .get(`/crm/reports/subscriptions?${query.toString()}`)
        .set("authorization", await bearer(subject))
        .expect(200);
      rows.push(...(res.body.data.items as ReportRow[]));
      cursor = res.body.data.nextCursor as string | null;
    } while (cursor);
    return rows;
  }

  const find = (rows: readonly ReportRow[], id: string) =>
    rows.find((row) => row.subscriptionId === id);

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
    const discovery = await prisma.plan.findUniqueOrThrow({ where: { planKey: "discovery" } });
    plan = {
      id: discovery.id,
      name: discovery.name,
      priceMinor: Math.round(discovery.priceAmount.toNumber() * 100),
    };
    ids.awaiting = await purchase(await account("Awaiting"));
    ids.paid = await purchase(await account("Paid"));
    await http()
      .post(`/crm/subscriptions/${ids.paid}/record-payment`)
      .set("authorization", await bearer("local:fa"))
      .send({ reference: "NEFT-REPORT-0001", method: "bank_transfer" })
      .expect(200);
    const demo = await prisma.subscription.create({
      data: { accountId: await account("Demo", true), planId: plan.id, status: "pending_payment" },
      select: { id: true },
    });
    ids.demo = demo.id;
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  it("gives Finance its queue: the subscription awaiting payment, as the strict report row", async () => {
    const rows = await allRows("local:fa", "pending_payment");
    const row = find(rows, ids.awaiting);
    expect(row).toBeDefined();
    expect(Object.keys(row!).sort()).toEqual(ROW_FIELDS);
    expect(row).toMatchObject({
      accountName: `${TAG} Awaiting`,
      planName: plan.name,
      amount: { minor: plan.priceMinor, currency: "INR" },
      status: "pending_payment",
      lastPayment: { method: "gateway", status: "initiated", paidAt: null },
    });
    // Paid subscriptions have left the queue; a demo account's never joins it.
    expect(find(rows, ids.paid)).toBeUndefined();
    expect(find(rows, ids.demo)).toBeUndefined();
  });

  it("shows a paid subscription as active, with the transfer Finance recorded", async () => {
    const row = find(await allRows("local:fa", "active"), ids.paid);
    expect(row?.status).toBe("active");
    expect(row?.lastPayment).toMatchObject({ method: "bank_transfer", status: "succeeded" });
    expect(row?.lastPayment?.paidAt).not.toBeNull();
  });

  it("reads the queue oldest first and the whole report newest first", async () => {
    const queue = (await allRows("local:fa", "pending_payment")).map((row) => row.createdAt);
    expect(queue).toEqual([...queue].sort());
    const all = (await allRows("local:fa")).map((row) => row.createdAt);
    expect(all).toEqual([...all].sort().reverse());
    expect(find(await allRows("local:fa"), ids.demo)).toBeUndefined();
  });

  it("pages by cursor without repeating a row", async () => {
    const first = await http()
      .get("/crm/reports/subscriptions?limit=1")
      .set("authorization", await bearer("local:fa"))
      .expect(200);
    expect(first.body.data.items).toHaveLength(1);
    const cursor = first.body.data.nextCursor as string;
    expect(cursor).toEqual(expect.any(String));
    const second = await http()
      .get(`/crm/reports/subscriptions?limit=1&cursor=${cursor}`)
      .set("authorization", await bearer("local:fa"))
      .expect(200);
    expect(second.body.data.items[0].subscriptionId).not.toBe(cursor);
  });

  it("lets the Super Admin and Sales run it too (§5.16)", async () => {
    for (const subject of ["local:admin", "local:sm"]) {
      expect(find(await allRows(subject, "pending_payment"), ids.awaiting), subject).toBeDefined();
    }
  });

  it("refuses the hotel team and a project manager as absence", async () => {
    for (const subject of ["local:ht", "local:pm"]) {
      const res = await http()
        .get("/crm/reports/subscriptions")
        .set("authorization", await bearer(subject));
      expect(res.status, subject).toBe(404);
      expect(res.body.error.code).toBe("not_found");
    }
  });

  it("rejects an unknown status at the edge", async () => {
    await http()
      .get("/crm/reports/subscriptions?status=unpaid")
      .set("authorization", await bearer("local:fa"))
      .expect(400);
  });
});
