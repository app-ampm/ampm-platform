import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

const PREFIX = "e2e-refs-";
// A plain Uuid for the DB CHECK test only: the API takes consent by upload, never as a supplied id.
const CONSENT_DOC = "0192f1a0-0000-7000-8000-00000000d0c1";
const CONSENT_PDF = Buffer.from("%PDF-1.4\n% E2E couple's consent\n%%EOF\n");
const MISSING = "0192f1a0-0000-7000-8000-0000000000ee"; // a well-formed id that matches no reference

/**
 * Previous-wedding references end to end (Module C, feature 9.3; GP-20, AC-24.3). A Super Admin creates a
 * reference, lists and reads it (the staff view carries the internal project/consent keys); the GP-20
 * publishing gate refuses client visibility without recorded consent (409) on both create and update, and
 * allows it once a consent document is uploaded — writing an audit event for the sharing change. A Sales
 * Manager may read references but not create one (403): the matrix split (read SA/SM/HT/PM; CRUD SA/HT).
 */
describe("Hotel wedding references (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;
  let prisma: PrismaService;
  let sa: string;
  let sm: string;
  let hotelId: string;
  let storageDir: string;

  async function removeFixtures(): Promise<void> {
    const hotels = await prisma.hotel.findMany({
      where: { slug: { startsWith: PREFIX } },
      select: { id: true },
    });
    const ids = hotels.map((h) => h.id);
    if (ids.length > 0) {
      const refs = await prisma.hotelWeddingReference.findMany({
        where: { hotelId: { in: ids } },
        select: { id: true },
      });
      const refIds = refs.map((r) => r.id);
      await prisma.auditEvent.deleteMany({
        where: { entityType: "hotel_wedding_reference", entityId: { in: refIds } },
      });
      const documentWhere = { ownerType: "hotel_wedding_reference", ownerId: { in: refIds } };
      await prisma.documentAccessLink.deleteMany({ where: { document: documentWhere } });
      await prisma.document.deleteMany({ where: documentWhere });
      await prisma.hotelWeddingReference.deleteMany({ where: { hotelId: { in: ids } } });
      await prisma.hotel.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.destination.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  }

  const http = () => request(app.getHttpServer());
  const base = () => `/hotels-admin/hotels/${hotelId}/wedding-references`;

  /** Upload the couple's consent to a reference; returns the consent document's id. */
  async function attachConsent(refId: string): Promise<string> {
    const attached = await http()
      .post(`${base()}/${refId}/consent`)
      .set("Authorization", sa)
      .set("content-type", "application/octet-stream")
      .send(CONSENT_PDF)
      .expect(200);
    return attached.body.data.consentDocumentId as string;
  }

  /** A new reference with consent on file, set client-visible; returns its id and consent id. */
  async function publishedReference(
    eventYear: number,
  ): Promise<{ refId: string; consent: string }> {
    const ref = await http().post(base()).set("Authorization", sa).send({ eventYear }).expect(201);
    const refId = ref.body.data.id as string;
    const consent = await attachConsent(refId);
    await http()
      .patch(`${base()}/${refId}`)
      .set("Authorization", sa)
      .send({ clientVisible: true })
      .expect(200);
    return { refId, consent };
  }

  beforeAll(async () => {
    storageDir = await mkdtemp(join(tmpdir(), "ampm-refs-"));
    process.env["STORAGE_LOCAL_DIR"] = storageDir;
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
    sa = `Bearer ${await mint("local:admin")}`;
    sm = `Bearer ${await mint("local:sm")}`;
    const dest = await http()
      .post("/hotels-admin/destinations")
      .set("Authorization", sa)
      .send({ name: "E2E Refs Destination", slug: `${PREFIX}dest` })
      .expect(201);
    const hotel = await http()
      .post("/hotels-admin/hotels")
      .set("Authorization", sa)
      .send({ destinationId: dest.body.data.id, name: "E2E Refs Hotel", slug: `${PREFIX}hotel` })
      .expect(201);
    hotelId = hotel.body.data.id;
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
    await rm(storageDir, { recursive: true, force: true });
  });

  it("creates, lists and reads a reference (the staff view carries the internal keys)", async () => {
    const created = await http()
      .post(base())
      .set("Authorization", sa)
      .send({ eventYear: 2024, guestCount: 320, descriptionClient: "A lakeside celebration" })
      .expect(201);
    expect(created.body.data).toMatchObject({
      hotelId,
      eventYear: 2024,
      guestCount: 320,
      clientVisible: false,
      projectId: null,
      consentDocumentId: null,
    });
    const refId = created.body.data.id;

    const list = await http().get(base()).set("Authorization", sa).expect(200);
    expect((list.body.data.items as { id: string }[]).map((r) => r.id)).toContain(refId);

    const read = await http().get(`${base()}/${refId}`).set("Authorization", sa).expect(200);
    expect(read.body.data).toHaveProperty("consentDocumentId"); // staff see the governance fields
    expect(read.body.data).toHaveProperty("projectId");
  });

  it("refuses client visibility without recorded consent (GP-20 → 409), on create and update", async () => {
    // Create with clientVisible but no consent document: refused.
    const denied = await http()
      .post(base())
      .set("Authorization", sa)
      .send({ eventYear: 2023, clientVisible: true })
      .expect(409);
    expect(denied.body.error.code).toBe("conflict");

    // Create internal, then try to publish it without consent: still refused.
    const ref = await http()
      .post(base())
      .set("Authorization", sa)
      .send({ eventYear: 2023 })
      .expect(201);
    const refId = ref.body.data.id;
    await http()
      .patch(`${base()}/${refId}`)
      .set("Authorization", sa)
      .send({ clientVisible: true })
      .expect(409);

    // Upload consent, then publish: allowed, and the sharing change is audited (AC-21).
    const consent = await attachConsent(refId);
    const published = await http()
      .patch(`${base()}/${refId}`)
      .set("Authorization", sa)
      .send({ clientVisible: true })
      .expect(200);
    expect(published.body.data).toMatchObject({ clientVisible: true, consentDocumentId: consent });
    // AC-21: the sharing change is audited with its before/after governance image, not just a bare row.
    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { entityType: "hotel_wedding_reference", entityId: refId, action: "update" },
      orderBy: { occurredAt: "desc" },
    });
    expect(audit.beforeJson).toMatchObject({ clientVisible: false });
    expect(audit.afterJson).toMatchObject({ clientVisible: true, consentDocumentId: consent });
  });

  it("refuses clearing consent while a reference stays client-visible (GP-20 → 409)", async () => {
    const { refId, consent } = await publishedReference(2024);

    // Clearing consent on a still-visible reference is exactly the state GP-20 forbids → refused.
    await http()
      .patch(`${base()}/${refId}`)
      .set("Authorization", sa)
      .send({ consentDocumentId: null })
      .expect(409);

    // The refusal left the row untouched: still visible, consent still on file.
    const read = await http().get(`${base()}/${refId}`).set("Authorization", sa).expect(200);
    expect(read.body.data).toMatchObject({ clientVisible: true, consentDocumentId: consent });

    // Unpublishing AND clearing consent together is allowed (the resulting state is not visible).
    await http()
      .patch(`${base()}/${refId}`)
      .set("Authorization", sa)
      .send({ clientVisible: false, consentDocumentId: null })
      .expect(200);
  });

  it("soft-deletes a reference (gone from list and read) and audits the delete with a before-image", async () => {
    const { refId, consent } = await publishedReference(2020);

    const removed = await http().delete(`${base()}/${refId}`).set("Authorization", sa).expect(200);
    expect(removed.body.data.id).toBe(refId);

    // Gone: a 404 on read and absent from the list (soft-delete scoping, denial equals absence).
    await http().get(`${base()}/${refId}`).set("Authorization", sa).expect(404);
    const list = await http().get(base()).set("Authorization", sa).expect(200);
    expect((list.body.data.items as { id: string }[]).map((r) => r.id)).not.toContain(refId);

    // The delete is audited with the consent before-image for the forensic trail (security.md).
    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { entityType: "hotel_wedding_reference", entityId: refId, action: "delete" },
    });
    expect(audit.beforeJson).toMatchObject({ clientVisible: true, consentDocumentId: consent });
    expect(audit.afterJson).toMatchObject({ deleted: true });
  });

  it("refuses a client-supplied consent id: consent arrives only by upload", async () => {
    // A made-up id would otherwise satisfy GP-20 without any consent on file (api.md: never trust it).
    await http()
      .post(base())
      .set("Authorization", sa)
      .send({ eventYear: 2022, clientVisible: true, consentDocumentId: CONSENT_DOC })
      .expect(400);
    const ref = await http()
      .post(base())
      .set("Authorization", sa)
      .send({ eventYear: 2022 })
      .expect(201);
    await http()
      .patch(`${base()}/${ref.body.data.id}`)
      .set("Authorization", sa)
      .send({ clientVisible: true, consentDocumentId: CONSENT_DOC })
      .expect(400);
  });

  it("lets a Sales Manager read references but not create, update or delete one (matrix split)", async () => {
    // Read is granted to SA/SM/HT/PM; create/update/delete only to SA/HT. The guard denies the write
    // before the handler runs, so a non-existent id still answers 403 (the permission decides, not the row).
    await http().get(base()).set("Authorization", sm).expect(200);
    await http().post(base()).set("Authorization", sm).send({ eventYear: 2021 }).expect(403);
    await http()
      .patch(`${base()}/${MISSING}`)
      .set("Authorization", sm)
      .send({ clientVisible: false })
      .expect(403);
    await http().delete(`${base()}/${MISSING}`).set("Authorization", sm).expect(403);
  });

  it("backstops GP-20 at the database: a client-visible reference needs consent (DB CHECK, slice 5c)", async () => {
    // A direct insert bypassing the service gate is still refused by the CHECK constraint, so the invariant
    // holds regardless of request interleaving (the service gate alone is check-then-act).
    await expect(
      prisma.hotelWeddingReference.create({
        data: { hotelId, eventYear: 2024, clientVisible: true, consentDocumentId: null },
      }),
    ).rejects.toThrow();
    // The permitted combinations still insert: internal with no consent, and client-visible WITH consent.
    const internal = await prisma.hotelWeddingReference.create({
      data: { hotelId, eventYear: 2024, clientVisible: false, consentDocumentId: null },
    });
    const visible = await prisma.hotelWeddingReference.create({
      data: { hotelId, eventYear: 2024, clientVisible: true, consentDocumentId: CONSENT_DOC },
    });
    expect(internal.clientVisible).toBe(false);
    expect(visible.consentDocumentId).toBe(CONSENT_DOC);
  });
});
