import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

const PREFIX = "e2e-refs-";
const CONSENT_DOC = "0192f1a0-0000-7000-8000-00000000d0c1"; // a plain Uuid; consent_document_id has no FK
const MISSING = "0192f1a0-0000-7000-8000-0000000000ee"; // a well-formed id that matches no reference

/**
 * Previous-wedding references end to end (Module C, feature 9.3; GP-20, AC-24.3). A Super Admin creates a
 * reference, lists and reads it (the staff view carries the internal project/consent keys); the GP-20
 * publishing gate refuses client visibility without recorded consent (409) on both create and update, and
 * allows it once a consent document is on file — writing an audit event for the sharing change. A Sales
 * Manager may read references but not create one (403): the matrix split (read SA/SM/HT/PM; CRUD SA/HT).
 */
describe("Hotel wedding references (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;
  let prisma: PrismaService;
  let sa: string;
  let sm: string;
  let hotelId: string;

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
      await prisma.auditEvent.deleteMany({
        where: { entityType: "hotel_wedding_reference", entityId: { in: refs.map((r) => r.id) } },
      });
      await prisma.hotelWeddingReference.deleteMany({ where: { hotelId: { in: ids } } });
      await prisma.hotel.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.destination.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  }

  const http = () => request(app.getHttpServer());
  const base = () => `/hotels-admin/hotels/${hotelId}/wedding-references`;

  beforeAll(async () => {
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

    // Provide consent and publish: allowed, and the sharing change is audited (AC-21).
    const published = await http()
      .patch(`${base()}/${refId}`)
      .set("Authorization", sa)
      .send({ clientVisible: true, consentDocumentId: CONSENT_DOC })
      .expect(200);
    expect(published.body.data).toMatchObject({
      clientVisible: true,
      consentDocumentId: CONSENT_DOC,
    });
    // AC-21: the sharing change is audited with its before/after governance image, not just a bare row.
    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { entityType: "hotel_wedding_reference", entityId: refId, action: "update" },
      orderBy: { occurredAt: "desc" },
    });
    expect(audit.beforeJson).toMatchObject({ clientVisible: false });
    expect(audit.afterJson).toMatchObject({ clientVisible: true, consentDocumentId: CONSENT_DOC });
  });

  it("refuses clearing consent while a reference stays client-visible (GP-20 → 409)", async () => {
    const ref = await http()
      .post(base())
      .set("Authorization", sa)
      .send({ eventYear: 2024, clientVisible: true, consentDocumentId: CONSENT_DOC })
      .expect(201);
    const refId = ref.body.data.id;

    // Clearing consent on a still-visible reference is exactly the state GP-20 forbids → refused.
    await http()
      .patch(`${base()}/${refId}`)
      .set("Authorization", sa)
      .send({ consentDocumentId: null })
      .expect(409);

    // The refusal left the row untouched: still visible, consent still on file.
    const read = await http().get(`${base()}/${refId}`).set("Authorization", sa).expect(200);
    expect(read.body.data).toMatchObject({ clientVisible: true, consentDocumentId: CONSENT_DOC });

    // Unpublishing AND clearing consent together is allowed (the resulting state is not visible).
    await http()
      .patch(`${base()}/${refId}`)
      .set("Authorization", sa)
      .send({ clientVisible: false, consentDocumentId: null })
      .expect(200);
  });

  it("soft-deletes a reference (gone from list and read) and audits the delete with a before-image", async () => {
    const ref = await http()
      .post(base())
      .set("Authorization", sa)
      .send({ eventYear: 2020, clientVisible: true, consentDocumentId: CONSENT_DOC })
      .expect(201);
    const refId = ref.body.data.id;

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
    expect(audit.beforeJson).toMatchObject({ clientVisible: true, consentDocumentId: CONSENT_DOC });
    expect(audit.afterJson).toMatchObject({ deleted: true });
  });

  it("creates a client-visible reference in one step when consent is supplied", async () => {
    await http()
      .post(base())
      .set("Authorization", sa)
      .send({ eventYear: 2022, clientVisible: true, consentDocumentId: CONSENT_DOC })
      .expect(201);
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
});
