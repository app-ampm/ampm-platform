import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";

import { PrismaService } from "../src/db/prisma.service.js";
import { startApi } from "./start-api.js";

/*
 * The hotel documents library's e2e suites (D-187 §6): a running API with a token for each role, a
 * destination and a first hotel; the library's routes as each role; and the clean-up of every hotel a
 * suite made, with its documents, their links and their audit rows. Imported by tests only.
 */

const OCTET = "application/octet-stream";

/** The roles the suites call as. */
export type Role = "sa" | "ht" | "sm" | "pm" | "cd" | "fa" | "client";

const ROLES: readonly Role[] = ["sa", "ht", "sm", "pm", "cd", "fa", "client"];

/** Each role's local identity subject (the seeded synthetic staff and client). */
const SUBJECTS: Readonly<Record<Role, string>> = {
  sa: "local:admin",
  ht: "local:ht",
  sm: "local:sm",
  pm: "local:pm",
  cd: "local:cd",
  fa: "local:fa",
  client: "local:client",
};

/** One of the committed content fixtures (test/fixtures/content; its README names each source). */
export const fixture = (name: string): Promise<Buffer> =>
  readFile(join(import.meta.dirname, "fixtures", "content", name));

/** A suite's running API and what it made. */
export interface LibrarySuite {
  readonly app: NestExpressApplication;
  readonly prisma: PrismaService;
  /** Each role's Authorization header. */
  readonly bearer: Readonly<Record<Role, string>>;
  readonly destinationId: string;
  /** The suite's first hotel: a call goes there unless it names another. */
  readonly hotelId: string;
  /** The slug prefix of every destination and hotel the suite makes, for its clean-up. */
  readonly prefix: string;
  readonly storageDir: string;
}

/**
 * Starts the API over a fresh storage folder, clears what an earlier run of the suite left, mints each
 * role's token and makes the suite's destination and first hotel.
 *
 * @example
 * beforeAll(async () => (suite = await startLibrarySuite("e2e-hoteldocs-")));
 */
export async function startLibrarySuite(prefix: string): Promise<LibrarySuite> {
  const storageDir = await mkdtemp(join(tmpdir(), "ampm-hoteldocs-"));
  process.env["STORAGE_LOCAL_DIR"] = storageDir;
  const { app, mint } = await startApi();
  const prisma = app.get(PrismaService);
  await removeLibraryFixtures(prisma, prefix);
  const bearer: Record<Role, string> = {
    sa: "",
    ht: "",
    sm: "",
    pm: "",
    cd: "",
    fa: "",
    client: "",
  };
  for (const role of ROLES) bearer[role] = `Bearer ${await mint(SUBJECTS[role])}`;
  const destination = await request(app.getHttpServer())
    .post("/hotels-admin/destinations")
    .set("Authorization", bearer.ht)
    .send({ name: `E2E Documents Destination ${prefix}`, slug: `${prefix}dest` })
    .expect(201);
  const made = { app, prisma, bearer, prefix, storageDir };
  const destinationId = destination.body.data.id as string;
  const hotelId = await newLibraryHotel({ ...made, destinationId }, "main");
  return { ...made, destinationId, hotelId };
}

/** A new hotel in the suite's destination, its slug under the suite's prefix. */
export async function newLibraryHotel(
  suite: Omit<LibrarySuite, "hotelId">,
  suffix: string,
): Promise<string> {
  const created = await request(suite.app.getHttpServer())
    .post("/hotels-admin/hotels")
    .set("Authorization", suite.bearer.ht)
    .send({
      destinationId: suite.destinationId,
      name: `E2E Documents Hotel ${suffix}`,
      slug: `${suite.prefix}${suffix}`,
    })
    .expect(201);
  return created.body.data.id as string;
}

/** Removes what the suite made, stops the API and deletes its storage folder. */
export async function stopLibrarySuite(suite: LibrarySuite): Promise<void> {
  await removeLibraryFixtures(suite.prisma, suite.prefix);
  await suite.app.close();
  await rm(suite.storageDir, { recursive: true, force: true });
}

async function removeLibraryFixtures(prisma: PrismaService, prefix: string): Promise<void> {
  const hotels = await prisma.hotel.findMany({
    where: { slug: { startsWith: prefix } },
    select: { id: true },
  });
  const where = { ownerType: "hotel", ownerId: { in: hotels.map((hotel) => hotel.id) } };
  const documents = await prisma.document.findMany({ where, select: { id: true } });
  const ids = documents.map((document) => document.id);
  const links = await prisma.documentAccessLink.findMany({
    where: { documentId: { in: ids } },
    select: { id: true },
  });
  await prisma.auditEvent.deleteMany({
    where: {
      OR: [
        { entityType: "document", entityId: { in: ids } },
        { entityType: "document_access_link", entityId: { in: links.map((link) => link.id) } },
      ],
    },
  });
  await prisma.documentAccessLink.deleteMany({ where: { documentId: { in: ids } } });
  await prisma.document.deleteMany({ where });
  await prisma.hotel.deleteMany({ where: { slug: { startsWith: prefix } } });
  await prisma.destination.deleteMany({ where: { slug: { startsWith: prefix } } });
}

/**
 * The library's routes as each role, for the suite `current` answers once it has started: a call goes
 * to the suite's first hotel unless it names another, as the Hotel team unless it names a role.
 *
 * @example
 * const { upload, list } = documentCalls(() => suite);
 * await upload(pdf, { type: "menu" }, "sa").expect(201);
 */
export function documentCalls(current: () => LibrarySuite) {
  const http = () => request(current().app.getHttpServer());
  const base = (hotel: string) => `/hotels-admin/hotels/${hotel}/documents`;
  const as = (role: Role) => current().bearer[role];
  const upload = (
    bytes: Buffer,
    query: Record<string, string>,
    role: Role = "ht",
    hotel = current().hotelId,
  ) =>
    http()
      .post(base(hotel))
      .query(query)
      .set("Authorization", as(role))
      .set("Content-Type", OCTET)
      .send(bytes);
  const list = (role: Role = "ht", hotel = current().hotelId) =>
    http().get(base(hotel)).set("Authorization", as(role));
  const mintLink = (documentId: string, role: Role = "ht", hotel = current().hotelId) =>
    http()
      .post(`${base(hotel)}/${documentId}/link`)
      .set("Authorization", as(role));
  const remove = (documentId: string, role: Role = "ht", hotel = current().hotelId) =>
    http()
      .delete(`${base(hotel)}/${documentId}`)
      .set("Authorization", as(role));
  return { http, upload, list, mintLink, remove };
}
