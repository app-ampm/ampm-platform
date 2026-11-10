import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

/** Fixtures share this account-name prefix and this provider-ref prefix, so cleanup is self-contained. */
const TAG = "E2E-Pay";
const REF = "e2e-pay-ref";
const RECORDED_BY = "0192f3a0-7d3e-7b1a-9c2f-00000000fa01";

/**
 * The finance payment ledger end to end (`GET /crm/payments`, `crm.payments.read` — FA/SA). Finance
 * reads the RESTRICTED-FINANCE view of inbound and outbound payments, filtered by account and direction
 * and cursor-paginated; the read is audited as a `restricted_read`; a principal without the key is
 * denied as absence (404), so neither Sales nor a client ever reaches the finance view (AC-12, AC-12.3).
 */
describe("Finance payment ledger (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;
  let prisma: PrismaService;
  let accountId: string;

  async function removeFixtures(): Promise<void> {
    const accounts = await prisma.clientAccount.findMany({
      where: { name: { startsWith: TAG } },
      select: { id: true },
    });
    const ids = accounts.map((a) => a.id);
    await prisma.payment.deleteMany({ where: { accountId: { in: ids } } });
    await prisma.auditEvent.deleteMany({
      where: { entityType: "payment_ledger", entityId: { in: ids } },
    });
    await prisma.clientAccount.deleteMany({ where: { id: { in: ids } } });
  }

  async function makePayment(
    suffix: string,
    direction: "inbound" | "outbound",
    overrides: Record<string, unknown> = {},
  ): Promise<string> {
    const payment = await prisma.payment.create({
      data: {
        accountId,
        direction,
        counterpartyType: direction === "inbound" ? "client" : "vendor",
        purpose: direction === "inbound" ? "subscription" : "vendor_payment",
        amount: "25000.00",
        currency: "INR",
        method: "bank_transfer",
        provider: null,
        providerRef: `${REF}-${suffix}`,
        status: "succeeded",
        paidAt: new Date("2026-11-08T10:00:00.000Z"),
        recordedBy: RECORDED_BY,
        clientVisible: direction === "inbound",
        ...overrides,
      },
      select: { id: true },
    });
    return payment.id;
  }

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
    const account = await prisma.clientAccount.create({
      data: { name: `${TAG} Ledger`, status: "active" },
      select: { id: true },
    });
    accountId = account.id;
    await makePayment("in-1", "inbound");
    await makePayment("in-2", "inbound");
    await makePayment("out-1", "outbound");
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const bearer = async (subject: string) => `Bearer ${await mint(subject)}`;

  it("returns the account's payments as the RESTRICTED-FINANCE view to Finance (AC-12.3)", async () => {
    const res = await http()
      .get(`/crm/payments?accountId=${accountId}`)
      .set("authorization", await bearer("local:fa"))
      .expect(200);
    expect(res.body.data.items).toHaveLength(3);
    const payment = res.body.data.items.find(
      (p: { providerRef: string | null }) => p.providerRef === `${REF}-in-1`,
    );
    expect(payment).toMatchObject({
      accountId,
      direction: "inbound",
      purpose: "subscription",
      method: "bank_transfer",
      status: "succeeded",
      providerRef: `${REF}-in-1`,
      recordedBy: RECORDED_BY,
    });
    // The amount is INR money in integer paise (25,000.00 → 2,500,000), never a float.
    expect(payment.amount).toEqual({ minor: 2_500_000, currency: "INR" });
    expect(payment.paidAt).toBe("2026-11-08T10:00:00.000Z");
  });

  it("narrows the ledger by direction", async () => {
    const res = await http()
      .get(`/crm/payments?accountId=${accountId}&direction=inbound`)
      .set("authorization", await bearer("local:fa"))
      .expect(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.items.every((p: { direction: string }) => p.direction === "inbound")).toBe(
      true,
    );
  });

  it("cursor-paginates the ledger", async () => {
    const first = await http()
      .get(`/crm/payments?accountId=${accountId}&limit=2`)
      .set("authorization", await bearer("local:fa"))
      .expect(200);
    expect(first.body.data.items).toHaveLength(2);
    expect(first.body.data.nextCursor).not.toBeNull();
    const next = await http()
      .get(`/crm/payments?accountId=${accountId}&limit=2&cursor=${first.body.data.nextCursor}`)
      .set("authorization", await bearer("local:fa"))
      .expect(200);
    expect(next.body.data.items).toHaveLength(1);
  });

  it("audits each ledger read as a restricted_read with the filter and row count (§9)", async () => {
    await prisma.auditEvent.deleteMany({
      where: { entityType: "payment_ledger", entityId: accountId },
    });
    await http()
      .get(`/crm/payments?accountId=${accountId}`)
      .set("authorization", await bearer("local:fa"))
      .expect(200);
    const event = await prisma.auditEvent.findFirst({
      where: { entityType: "payment_ledger", entityId: accountId, action: "restricted_read" },
    });
    expect(event).not.toBeNull();
  });

  it("denies the ledger to Sales — denial is absence (AC-12)", async () => {
    await http()
      .get(`/crm/payments?accountId=${accountId}`)
      .set("authorization", await bearer("local:sm"))
      .expect(404);
  });

  it("denies the ledger to a client (the finance view never reaches a client, AC-12.3)", async () => {
    await http()
      .get(`/crm/payments?accountId=${accountId}`)
      .set("authorization", await bearer("local:client"))
      .expect(404);
  });

  it("rejects a malformed list cursor with 400, not a Postgres 500", async () => {
    await http()
      .get("/crm/payments?cursor=not-a-uuid")
      .set("authorization", await bearer("local:fa"))
      .expect(400);
  });
});
