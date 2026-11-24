import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

const TAG = "E2E-Contract";
const PREFIX = "e2e-contract";
const OCTET = "application/octet-stream";
const PDF = Buffer.from("%PDF-1.4\n% E2E signed contract\n%%EOF\n");
const PDF_V2 = Buffer.from("%PDF-1.7\n% E2E signed contract, countersigned\n%%EOF\n");

/**
 * The signed contract on a `contract_signed` booking milestone end to end (D-132, Module N's first
 * slice): the upload is typed by content and scanned before anything is kept, only a pending or overdue
 * `contract_signed` milestone takes one, a replacement becomes the next version, and the file is reached
 * only through a minted link that expires, is capped, and answers anything wrong with a 404. The
 * confirmed-guard flow that uses it lives in booking-milestones.e2e-spec.ts.
 */
describe("Booking milestone signed contract (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let mint: (subject: string) => Promise<string>;
  let storageDir: string;
  let enquiryId: string;
  // Bearer headers for the seeded staff, minted once: HT and FA may update milestones, SM only reads.
  const bearer: Record<"ht" | "sm" | "fa", string> = { ht: "", sm: "", fa: "" };

  const http = () => request(app.getHttpServer());

  async function removeFixtures(): Promise<void> {
    const accounts = await prisma.clientAccount.findMany({
      where: { name: { startsWith: TAG } },
      select: { id: true },
    });
    const enquiries = await prisma.hotelEnquiry.findMany({
      where: { accountId: { in: accounts.map((a) => a.id) } },
      select: { id: true },
    });
    const enquiryIds = enquiries.map((e) => e.id);
    const milestones = await prisma.bookingMilestone.findMany({
      where: { enquiryId: { in: enquiryIds } },
      select: { id: true },
    });
    const documentWhere = { ownerId: { in: milestones.map((m) => m.id) } };
    await prisma.documentAccessLink.deleteMany({ where: { document: documentWhere } });
    await prisma.document.deleteMany({ where: documentWhere });
    await prisma.bookingMilestone.deleteMany({ where: { enquiryId: { in: enquiryIds } } });
    await prisma.hotelEnquiryEvent.deleteMany({ where: { enquiryId: { in: enquiryIds } } });
    await prisma.hotelEnquiry.deleteMany({ where: { id: { in: enquiryIds } } });
    await prisma.clientAccount.deleteMany({ where: { id: { in: accounts.map((a) => a.id) } } });
    await prisma.hotel.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.destination.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  }

  async function newMilestone(milestoneType = "contract_signed"): Promise<string> {
    const created = await http()
      .post("/consultancy-admin/booking-milestones")
      .set("authorization", bearer.ht)
      .send({ enquiryId, milestoneType })
      .expect(201);
    return created.body.data.id as string;
  }

  const attach = (milestoneId: string, bytes: Buffer, as: keyof typeof bearer = "ht") =>
    http()
      .post(`/consultancy-admin/booking-milestones/${milestoneId}/contract`)
      .set("authorization", bearer[as])
      .set("content-type", OCTET)
      .send(bytes);

  // SM mints the link: viewing needs only read on the milestone.
  const mintLink = (milestoneId: string) =>
    http()
      .post(`/consultancy-admin/booking-milestones/${milestoneId}/contract/link`)
      .set("authorization", bearer.sm);

  beforeAll(async () => {
    storageDir = await mkdtemp(join(tmpdir(), "ampm-contract-"));
    process.env["STORAGE_LOCAL_DIR"] = storageDir;
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
    for (const role of ["ht", "sm", "fa"] as const)
      bearer[role] = `Bearer ${await mint(`local:${role}`)}`;
    const requester = await prisma.user.findFirstOrThrow({
      where: { identitySubject: "local:client" },
      select: { id: true },
    });
    const destination = await prisma.destination.create({
      data: { name: `${TAG} Jaipur`, slug: `${PREFIX}-jaipur`, country: "India", status: "active" },
      select: { id: true },
    });
    const hotel = await prisma.hotel.create({
      data: {
        destinationId: destination.id,
        name: `${TAG} Fort`,
        slug: `${PREFIX}-fort`,
        descriptionClient: "A synthetic test hotel.",
        status: "active",
      },
      select: { id: true },
    });
    const account = await prisma.clientAccount.create({
      data: { name: `${TAG} Account`, status: "prospect" },
      select: { id: true },
    });
    const enquiry = await prisma.hotelEnquiry.create({
      data: {
        accountId: account.id,
        hotelId: hotel.id,
        requestedByUserId: requester.id,
        status: "client_decision",
        dateFrom: new Date("2027-03-01"),
        dateTo: new Date("2027-03-03"),
        guestEstimate: 150,
      },
      select: { id: true },
    });
    enquiryId = enquiry.id;
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
    await rm(storageDir, { recursive: true, force: true });
  });

  it("refuses a client-supplied documentId: a contract arrives only by upload", async () => {
    await http()
      .post("/consultancy-admin/booking-milestones")
      .set("authorization", bearer.ht)
      .send({
        enquiryId,
        milestoneType: "contract_signed",
        documentId: "00000000-0000-7000-8000-0000000000dd",
      })
      .expect(400);
  });

  it("refuses a file by content, refuses an infected one, and keeps nothing of either", async () => {
    const milestoneId = await newMilestone();
    const exe = Buffer.concat([Buffer.from("MZ"), Buffer.from("a renamed executable.pdf")]);
    await attach(milestoneId, exe).expect(400);
    const eicar = Buffer.concat([PDF, Buffer.from("EICAR-STANDARD-ANTIVIRUS-TEST-FILE")]);
    const infected = await attach(milestoneId, eicar);
    expect(infected.status).toBe(400);
    expect(infected.body.error.message).toMatch(/antivirus/i);

    expect(await prisma.document.count({ where: { ownerId: milestoneId } })).toBe(0);
    const stored = await readdir(storageDir, { recursive: true }).catch(() => []);
    expect(stored.filter((path) => path.includes(milestoneId))).toEqual([]);
    const row = await prisma.bookingMilestone.findUniqueOrThrow({ where: { id: milestoneId } });
    expect(row.documentId).toBeNull();
  });

  it("will not mark a contract_signed milestone done before its contract is attached", async () => {
    const milestoneId = await newMilestone();
    const notYet = await http()
      .patch(`/consultancy-admin/booking-milestones/${milestoneId}/status`)
      .set("authorization", bearer.ht)
      .send({ status: "done" })
      .expect(409);
    expect(notYet.body.error.message).toMatch(/signed contract/i);
  });

  it("takes a contract only on a contract_signed milestone, and only from a role that may update it", async () => {
    const hold = await newMilestone("hold_placed");
    await attach(hold, PDF).expect(409);
    const milestoneId = await newMilestone();
    await attach(milestoneId, PDF, "sm").expect(403); // SM reads milestones, never writes
    await attach(milestoneId, PDF, "fa").expect(200); // FA has RU on milestones
  });

  it("serves the contract only through a minted, capped, expiring link (denial equals absence)", async () => {
    const milestoneId = await newMilestone();
    await mintLink(milestoneId).expect(404); // nothing attached yet
    await attach(milestoneId, PDF).expect(200);

    const minted = await mintLink(milestoneId).expect(201);
    const url = minted.body.data.url as string;
    const mintedLinkId = url.split("/")[3] ?? "";
    // Opening access to the contract is recorded: who minted which link (security.md).
    expect(
      await prisma.auditEvent.count({
        where: { entityType: "document_access_link", entityId: mintedLinkId, action: "create" },
      }),
    ).toBe(1);
    expect(url).toMatch(/^\/documents\/links\/[0-9a-f-]{36}\/[A-Za-z0-9_-]{43}$/);
    expect(Date.parse(minted.body.data.expiresAt) - Date.now()).toBeLessThanOrEqual(15 * 60_000);

    const download = await http().get(url).responseType("blob").expect(200); // public: the link is the capability
    expect(download.headers["content-type"]).toContain("application/pdf");
    // Served restrictively (D-187 §5): no active content, same-site only, a PDF inline but unsandboxed.
    expect(download.headers).toMatchObject({
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'",
      "cross-origin-resource-policy": "same-site",
      "content-disposition": 'inline; filename="contract.pdf"',
      "cache-control": "private, no-store",
    });
    expect(Buffer.from(download.body).equals(PDF)).toBe(true);

    await http()
      .get(url.replace(/\/[^/]+$/, `/${"A".repeat(43)}`))
      .expect(404); // a forged token
    for (let fetched = 1; fetched < 5; fetched += 1) await http().get(url).expect(200);
    await http().get(url).expect(404); // past the download cap

    const fresh = (await mintLink(milestoneId).expect(201)).body.data.url as string;
    const linkId = fresh.split("/")[3] ?? "";
    await prisma.documentAccessLink.update({
      where: { id: linkId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await http().get(fresh).expect(404); // expired
  });

  it("files a replacement as the next version, and a done milestone takes no more uploads", async () => {
    const milestoneId = await newMilestone();
    const first = (await attach(milestoneId, PDF).expect(200)).body.data.documentId;
    const second = (await attach(milestoneId, PDF_V2).expect(200)).body.data.documentId;
    expect(second).not.toBe(first);
    const v2 = await prisma.document.findUniqueOrThrow({ where: { id: second } });
    expect(v2).toMatchObject({
      ownerType: "booking_milestone",
      ownerId: milestoneId,
      documentType: "contract",
      visibility: "internal",
      mimeType: "application/pdf",
      sizeBytes: PDF_V2.length,
      versionNumber: 2,
      previousVersionId: first,
    });
    const audits = await prisma.auditEvent.count({
      where: { entityType: "document", entityId: { in: [first, second] }, action: "create" },
    });
    expect(audits).toBe(2);

    await http()
      .patch(`/consultancy-admin/booking-milestones/${milestoneId}/status`)
      .set("authorization", bearer.ht)
      .send({ status: "done" })
      .expect(200);
    await attach(milestoneId, PDF).expect(409);
  });

  it("never reads a binary body on any other milestone route: it carries no record (D-187)", async () => {
    const milestoneId = await newMilestone();
    const before = await prisma.bookingMilestone.findUniqueOrThrow({ where: { id: milestoneId } });
    const res = await http()
      .patch(`/consultancy-admin/booking-milestones/${milestoneId}`)
      .set("authorization", bearer.ht)
      .set("content-type", OCTET)
      .send(PDF)
      .expect(400);
    expect(res.body.error.code).toBe("validation_failed");
    const after = await prisma.bookingMilestone.findUniqueOrThrow({ where: { id: milestoneId } });
    expect(after).toEqual(before);
  });
});
