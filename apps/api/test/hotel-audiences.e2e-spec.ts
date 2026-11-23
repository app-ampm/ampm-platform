import type { NestExpressApplication } from "@nestjs/platform-express";
import { STAFF_ROLES } from "@ampm/policy";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

/** Fixture hotels and the destination carry this slug prefix, so the suite cleans up after itself. */
const PREFIX = "e2e-audience-";
const NAME = "E2E Audience Hotel";
const NOTES = "Synthetic internal note for the audience suite";
/** The seeded wedding (prisma/seed.ts SEED.projectId): the Hospitality Lead is a member of it. */
const SEED_PROJECT_ID = "0192f3a0-7d3e-7b1a-9c2f-0000000000a1";
const HL = { email: "hl-audience-e2e@example.com", subject: "local:hl-audience-e2e" };

interface CustomFixture {
  /** The custom role's `role_key`. */
  readonly role: string;
  readonly email: string;
  readonly subject: string;
  readonly capabilities: readonly string[];
}

/**
 * A custom role that edits profiles and reads contacts, but holds no key on the internal notes, the
 * destinations or the hotel media.
 */
const CONTACTS_EDITOR: CustomFixture = {
  role: "custom_hotel_contacts_e2e",
  email: "custom-hotel-contacts-e2e@example.com",
  subject: "local:custom-hotel-contacts-e2e",
  capabilities: [
    "hotels.hotel_profiles_client_fields.read:all",
    "hotels.hotel_profiles_client_fields.create:all",
    "hotels.hotel_profiles_client_fields.update:all",
    "hotels.hotel_contacts.read:all",
  ],
};
/** A custom role that reads the notes and may edit contacts, but cannot read the contacts. */
const NOTES_READER: CustomFixture = {
  role: "custom_hotel_notes_e2e",
  email: "custom-hotel-notes-e2e@example.com",
  subject: "local:custom-hotel-notes-e2e",
  capabilities: [
    "hotels.hotel_profiles_client_fields.read:all",
    "hotels.hotel_internal_rating_notes.read:all",
    "hotels.hotel_contacts.update:all",
  ],
};
const RESTRICTED = ["internalRating", "internalNotes", "contacts"] as const;

/**
 * The staff hotel answers each audience with its own model (D-171): the internal rating and notes and
 * the contacts reach only principals whose grants read them, a custom role's included (D-164), in the
 * list, the detail and the write responses; a notes write needs the notes key; a contact edit, which
 * answers with the whole contact, needs the contacts read. All fixtures are synthetic.
 */
describe("Staff hotel audiences (e2e)", () => {
  let app: NestExpressApplication;
  let mint: (subject: string) => Promise<string>;
  let prisma: PrismaService;
  let hotelId = "";
  let contactId = "";

  const http = () => request(app.getHttpServer());
  const bearer = async (subject: string) => `Bearer ${await mint(subject)}`;
  const detail = async (subject: string): Promise<Record<string, unknown>> =>
    (
      await http()
        .get(`/hotels-admin/hotels/${hotelId}`)
        .set("Authorization", await bearer(subject))
    ).body.data;
  const listed = async (subject: string): Promise<Record<string, unknown> | undefined> => {
    const res = await http()
      .get("/hotels-admin/hotels")
      .query({ q: NAME })
      .set("Authorization", await bearer(subject))
      .expect(200);
    const items: Record<string, unknown>[] = res.body.data.items;
    return items.find((item) => item["id"] === hotelId);
  };
  const storedHotel = () => prisma.hotel.findUniqueOrThrow({ where: { id: hotelId } });

  async function removeUser(email: string): Promise<void> {
    const user = await prisma.user.findFirst({ where: { email } });
    if (!user) return;
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.projectMember.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }

  async function removeFixtures(): Promise<void> {
    for (const email of [HL.email, CONTACTS_EDITOR.email, NOTES_READER.email]) {
      await removeUser(email);
    }
    for (const fixture of [CONTACTS_EDITOR, NOTES_READER]) {
      const role = await prisma.role.findUnique({ where: { roleKey: fixture.role } });
      if (!role) continue;
      await prisma.roleGrant.deleteMany({ where: { roleId: role.id } });
      await prisma.role.delete({ where: { id: role.id } });
    }
    const hotels = await prisma.hotel.findMany({ where: { slug: { startsWith: PREFIX } } });
    const ids = hotels.map((hotel) => hotel.id);
    const contacts = await prisma.hotelContact.findMany({ where: { hotelId: { in: ids } } });
    const entityIds = [...ids, ...contacts.map((contact) => contact.id)];
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: entityIds } } });
    await prisma.hotelContact.deleteMany({ where: { hotelId: { in: ids } } });
    await prisma.hotel.deleteMany({ where: { id: { in: ids } } });
    await prisma.destination.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  }

  async function staffUser(email: string, subject: string, roleId: string): Promise<string> {
    const user = await prisma.user.create({
      data: {
        userType: "staff",
        name: "Test Staff",
        email,
        status: "active",
        identitySubject: subject,
      },
    });
    await prisma.userRole.create({ data: { userId: user.id, roleId } });
    return user.id;
  }

  async function customRole(fixture: CustomFixture): Promise<void> {
    const role = await prisma.role.create({
      data: { roleKey: fixture.role, name: `Custom ${fixture.role}`, isSystem: false },
    });
    for (const capabilityKey of fixture.capabilities) {
      const capability = await prisma.grantableCapability.findUniqueOrThrow({
        where: { capabilityKey },
      });
      await prisma.roleGrant.create({
        data: { roleId: role.id, grantableCapabilityId: capability.id },
      });
    }
    await staffUser(fixture.email, fixture.subject, role.id);
  }

  async function seedHotel(): Promise<void> {
    const destination = await prisma.destination.create({
      data: { name: "E2E Audience Destination", slug: `${PREFIX}dest`, country: "India" },
    });
    const hotel = await prisma.hotel.create({
      data: {
        destinationId: destination.id,
        name: NAME,
        slug: `${PREFIX}hotel`,
        status: "active",
        internalRating: 4,
        internalNotes: NOTES,
      },
    });
    const contact = await prisma.hotelContact.create({
      data: {
        hotelId: hotel.id,
        name: "Test Contact",
        email: "contact@example.com",
        isPrimary: true,
      },
    });
    hotelId = hotel.id;
    contactId = contact.id;
  }

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    prisma = app.get(PrismaService);
    await removeFixtures();
    await seedHotel();
    const hospitality = await prisma.role.findUniqueOrThrow({
      where: { roleKey: STAFF_ROLES.HL.key },
    });
    const hl = await staffUser(HL.email, HL.subject, hospitality.id);
    await prisma.projectMember.create({
      data: { projectId: SEED_PROJECT_ID, userId: hl, projectRole: "staff", status: "active" },
    });
    await customRole(CONTACTS_EDITOR);
    await customRole(NOTES_READER);
  });

  afterAll(async () => {
    await removeFixtures();
    await app.close();
  });

  it("gives the Super Admin, Sales, the Hotel team and a Project Manager the notes and the contacts", async () => {
    for (const subject of ["local:admin", "local:sm", "local:ht", "local:pm"]) {
      const hotel = await detail(subject);
      expect(hotel).toMatchObject({ internalRating: 4, internalNotes: NOTES });
      expect(hotel["contacts"]).toEqual([expect.objectContaining({ id: contactId })]);
      expect(await listed(subject)).toMatchObject({ internalNotes: NOTES });
    }
  });

  it("gives Creative and Finance the profile alone, in the detail and the list", async () => {
    for (const subject of ["local:cd", "local:fa"]) {
      const hotel = await detail(subject);
      expect(hotel).toMatchObject({ id: hotelId, rooms: [], venues: [] });
      for (const field of RESTRICTED) expect(hotel).not.toHaveProperty(field);
      const item = await listed(subject);
      expect(item).toMatchObject({ id: hotelId, name: NAME });
      expect(item).not.toHaveProperty("internalNotes");
      expect(item).not.toHaveProperty("internalRating");
    }
  });

  it("gives a Hospitality Lead no contacts while no wedding of theirs names the hotel (R (a))", async () => {
    const hotel = await detail(HL.subject);
    expect(hotel).toMatchObject({ id: hotelId });
    for (const field of RESTRICTED) expect(hotel).not.toHaveProperty(field);
  });

  it("D-164: answers a custom role from its grants, contacts without notes or notes without contacts", async () => {
    const contactsReader = await detail(CONTACTS_EDITOR.subject);
    expect(contactsReader["contacts"]).toEqual([expect.objectContaining({ id: contactId })]);
    expect(contactsReader).not.toHaveProperty("internalNotes");
    expect(await listed(CONTACTS_EDITOR.subject)).not.toHaveProperty("internalNotes");
    const notesReader = await detail(NOTES_READER.subject);
    expect(notesReader).toMatchObject({ internalRating: 4, internalNotes: NOTES });
    expect(notesReader).not.toHaveProperty("contacts");
  });

  it("refuses a notes write without the notes key and keeps the notes; other edits answer without them", async () => {
    const editor = await bearer(CONTACTS_EDITOR.subject);
    const patch = (body: object) =>
      http().patch(`/hotels-admin/hotels/${hotelId}`).set("Authorization", editor).send(body);
    await patch({ internalNotes: null }).expect(403);
    await patch({ internalRating: 5 }).expect(403);
    const res = await patch({ totalRooms: 41 }).expect(200);
    expect(res.body.data).toMatchObject({ totalRooms: 41, contacts: [expect.anything()] });
    expect(res.body.data).not.toHaveProperty("internalNotes");
    expect(await storedHotel()).toMatchObject({ internalRating: 4, internalNotes: NOTES });
  });

  it("lets a create without the notes key carry no notes, and refuses one that sets them", async () => {
    const editor = await bearer(CONTACTS_EDITOR.subject);
    const destination = await prisma.destination.findFirstOrThrow({
      where: { slug: `${PREFIX}dest` },
    });
    const body = { destinationId: destination.id, name: "E2E Audience Second" };
    const create = (extra: object) =>
      http()
        .post("/hotels-admin/hotels")
        .set("Authorization", editor)
        .send({ ...body, ...extra });
    await create({ slug: `${PREFIX}refused`, internalNotes: "Not theirs to write" }).expect(403);
    const res = await create({ slug: `${PREFIX}second`, internalNotes: null }).expect(201);
    expect(res.body.data).toMatchObject({ slug: `${PREFIX}second`, contacts: [] });
    expect(res.body.data).not.toHaveProperty("internalNotes");
    expect(await prisma.hotel.count({ where: { slug: `${PREFIX}refused` } })).toBe(0);
  });

  it("refuses an import row's notes cell without the notes key, applying the other rows (D-171)", async () => {
    const csv = [
      "destinationSlug,name,slug,internalNotes",
      `${PREFIX}dest,E2E Audience Imported,${PREFIX}imported,`,
      `${PREFIX}dest,E2E Audience Noted,${PREFIX}noted,Not theirs to write`,
    ].join("\n");
    const res = await http()
      .post("/hotels-admin/imports/hotels")
      .set("Authorization", await bearer(CONTACTS_EDITOR.subject))
      .set("Content-Type", "text/csv")
      .send(csv)
      .expect(200);
    expect(res.body.data).toMatchObject({
      created: 1,
      rejected: [{ line: 3, errors: [{ field: "internalNotes" }] }],
    });
    expect(await prisma.hotel.count({ where: { slug: `${PREFIX}noted` } })).toBe(0);
  });

  it("refuses an import row that creates a destination or adds an image without those keys (D-181)", async () => {
    const csv = [
      "destinationSlug,name,slug,imageRef",
      `${PREFIX}elsewhere,E2E Audience Elsewhere,${PREFIX}elsewhere,`,
      `${PREFIX}dest,E2E Audience Pictured,${PREFIX}pictured,https://img.example/pictured.jpg`,
    ].join("\n");
    const res = await http()
      .post("/hotels-admin/imports/hotels")
      .set("Authorization", await bearer(CONTACTS_EDITOR.subject))
      .set("Content-Type", "text/csv")
      .send(csv)
      .expect(200);
    expect(res.body.data).toMatchObject({
      applied: false,
      created: 0,
      rejected: [
        { line: 2, errors: [{ field: "destinationSlug" }] },
        { line: 3, errors: [{ field: "imageRef" }] },
      ],
    });
    expect(await prisma.destination.count({ where: { slug: `${PREFIX}elsewhere` } })).toBe(0);
    const slugs = [`${PREFIX}elsewhere`, `${PREFIX}pictured`];
    expect(await prisma.hotel.count({ where: { slug: { in: slugs } } })).toBe(0);
  });

  it("lets the Hotel team write the notes", async () => {
    const res = await http()
      .patch(`/hotels-admin/hotels/${hotelId}`)
      .set("Authorization", await bearer("local:ht"))
      .send({ internalRating: 3 })
      .expect(200);
    expect(res.body.data).toMatchObject({ internalRating: 3, internalNotes: NOTES });
  });

  it("answers a contact edit only to a reader of the contacts", async () => {
    const edit = (authorization: string) =>
      http()
        .patch(`/hotels-admin/hotels/${hotelId}/contacts/${contactId}`)
        .set("Authorization", authorization)
        .send({ roleTitle: "Events" });
    await edit(await bearer(NOTES_READER.subject)).expect(404);
    const stored = await prisma.hotelContact.findUniqueOrThrow({ where: { id: contactId } });
    expect(stored.roleTitle).toBeNull();
    const res = await edit(await bearer("local:ht")).expect(200);
    expect(res.body.data).toMatchObject({ id: contactId, roleTitle: "Events" });
  });
});
