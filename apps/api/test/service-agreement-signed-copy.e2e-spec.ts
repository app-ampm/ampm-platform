import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

const TAG = "E2E-AgreementCopy";
const PDF = Buffer.from("%PDF-1.4\n% E2E signed service agreement\n%%EOF\n");
const OCTET = "application/octet-stream";

/**
 * Who accepts a service agreement (feature 10.2, D-135): the client in the portal, or staff by attaching
 * the copy the client signed outside the app — never staff moving the status to `accepted` themselves.
 * The signed copy is stored by Module N and opened only through a minted, expiring link.
 */
describe("Service agreement signed copy (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let mint: (subject: string) => Promise<string>;
  let storageDir: string;
  let accountId: string;
  let serviceTypeId: string;

  const http = () => request(app.getHttpServer());
  const sm = async () => `Bearer ${await mint("local:sm")}`;

  async function removeFixtures(): Promise<void> {
    const accounts = await prisma.clientAccount.findMany({
      where: { name: { startsWith: TAG } },
      select: { id: true },
    });
    const accountIds = accounts.map((account) => account.id);
    const agreements = await prisma.serviceAgreement.findMany({
      where: { accountId: { in: accountIds } },
      select: { id: true },
    });
    const documentWhere = { ownerId: { in: agreements.map((agreement) => agreement.id) } };
    await prisma.documentAccessLink.deleteMany({ where: { document: documentWhere } });
    await prisma.document.deleteMany({ where: documentWhere });
    await prisma.serviceAgreement.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.clientAccount.deleteMany({ where: { id: { in: accountIds } } });
  }

  /** A negotiation agreement, created and sent to the client by Sales: waiting on the client. */
  async function sentAgreement(): Promise<string> {
    const created = await http()
      .post("/crm/service-agreements")
      .set("authorization", await sm())
      .send({
        accountId,
        serviceTypeId,
        hotelEnquiryId: null,
        scopeText: "Negotiate room rates for the February wedding.",
        fee: { minor: 2500000, currency: "INR" },
        feeStructure: "fixed",
        termsVersion: "v1",
      })
      .expect(201);
    const id = created.body.data.id as string;
    await http()
      .patch(`/crm/service-agreements/${id}/status`)
      .set("authorization", await sm())
      .send({ status: "sent" })
      .expect(200);
    return id;
  }

  const attach = async (id: string, bytes: Buffer) =>
    http()
      .post(`/crm/service-agreements/${id}/signed-copy`)
      .set("authorization", await sm())
      .set("content-type", OCTET)
      .send(bytes);

  beforeAll(async () => {
    storageDir = await mkdtemp(join(tmpdir(), "ampm-agreement-copy-"));
    process.env["STORAGE_LOCAL_DIR"] = storageDir;
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
    serviceTypeId = (
      await prisma.serviceType.findUniqueOrThrow({ where: { serviceKey: "negotiation" } })
    ).id;
    accountId = (
      await prisma.clientAccount.create({
        data: { name: `${TAG} Mehta family`, status: "prospect" },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
    await rm(storageDir, { recursive: true, force: true });
  });

  it("refuses a staff accept through the status route, naming the signed-copy path", async () => {
    const id = await sentAgreement();
    const refused = await http()
      .patch(`/crm/service-agreements/${id}/status`)
      .set("authorization", await sm())
      .send({ status: "accepted" })
      .expect(409);
    expect(refused.body.error.message).toMatch(/client accepts.*signed copy/i);
    const row = await prisma.serviceAgreement.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe("sent");
  });

  it("records an agreement signed outside the app from its signed copy, then serves it by link", async () => {
    const id = await sentAgreement();
    await http()
      .post(`/crm/service-agreements/${id}/signed-copy/link`)
      .set("authorization", await sm())
      .expect(404); // nothing attached yet
    const signed = await attach(id, PDF);
    expect(signed.status).toBe(200);
    expect(signed.body.data).toMatchObject({ status: "accepted", acceptedByUserId: null });
    expect(signed.body.data.documentId).toEqual(expect.any(String));
    expect(signed.body.data.acceptedAt).toEqual(expect.any(String));

    // Only an agreement still waiting on the client can be marked signed: a second copy is refused.
    expect((await attach(id, PDF)).status).toBe(409);

    const minted = await http()
      .post(`/crm/service-agreements/${id}/signed-copy/link`)
      .set("authorization", await sm())
      .expect(201);
    const url = minted.body.data.url as string;
    expect(url).toMatch(/^\/documents\/links\/[0-9a-f-]{36}\/[A-Za-z0-9_-]{43}$/);
    const download = await http().get(url).expect(200);
    expect(download.headers["content-type"]).toMatch(/application\/pdf/);

    // Staff then activate it, which starts the work.
    const active = await http()
      .patch(`/crm/service-agreements/${id}/status`)
      .set("authorization", await sm())
      .send({ status: "active" })
      .expect(200);
    expect(active.body.data.status).toBe("active");
  });

  it("refuses a copy that is not a document, keeping the agreement waiting on the client", async () => {
    const id = await sentAgreement();
    const exe = Buffer.concat([Buffer.from("MZ"), Buffer.from("a renamed executable.pdf")]);
    expect((await attach(id, exe)).status).toBe(400);
    const row = await prisma.serviceAgreement.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ status: "sent", documentId: null });
    expect(await prisma.document.count({ where: { ownerId: id } })).toBe(0);
  });

  it("takes only raw bytes, and only from a signed-in staff member", async () => {
    const id = await sentAgreement();
    await http()
      .post(`/crm/service-agreements/${id}/signed-copy`)
      .set("authorization", await sm())
      .send({ documentId: "00000000-0000-7000-8000-0000000000dd" })
      .expect(400);
    await http()
      .post(`/crm/service-agreements/${id}/signed-copy`)
      .set("content-type", OCTET)
      .send(PDF)
      .expect(401);
  });
});
